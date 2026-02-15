import { Camera } from '../rendering/camera';
import { pixelToHex } from '../hex/hex';
import { World } from '../world/world';
import { InputMode, TerrainType, BuildType } from '../types';
import { BUILD_COSTS, PHEROMONE_PAINT_AMOUNT, PHEROMONE_MAX } from '../constants';
import { hexKey } from '../hex/hex';

export class InputHandler {
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private world!: World;
  private getValidBuildHexes!: () => Set<string>;
  private onFirstClick: (() => void) | null = null;
  private firstClickFired = false;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.camera = camera;
    this.canvas = canvas;
    this.bindEvents();
  }

  setWorld(world: World) {
    this.world = world;
  }

  setValidBuildHexesGetter(fn: () => Set<string>) {
    this.getValidBuildHexes = fn;
  }

  setFirstClickCallback(fn: () => void) {
    this.onFirstClick = fn;
  }

  private getDpr(): number {
    return window.devicePixelRatio || 1;
  }

  private bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousemove', (e) => this.onMouseMove(e));
    c.addEventListener('mousedown', (e) => this.onMouseDown(e));
    c.addEventListener('mouseup', (e) => this.onMouseUp(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mouseleave', () => this.onMouseLeave());

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.world) return;
    const dpr = this.getDpr();
    const sx = e.offsetX * dpr;
    const sy = e.offsetY * dpr;
    const input = this.world.inputState;

    if (input.isPanning) {
      const dx = (e.offsetX - input.lastMouseX) * dpr;
      const dy = (e.offsetY - input.lastMouseY) * dpr;
      this.camera.pan(dx, dy);
    }

    input.lastMouseX = e.offsetX;
    input.lastMouseY = e.offsetY;

    // Update hovered hex
    const wp = this.camera.screenToWorld(sx, sy);
    const hex = pixelToHex(wp.x, wp.y);
    if (this.world.grid.has(hex.q, hex.r)) {
      input.hoveredHex = hex;
    } else {
      input.hoveredHex = null;
    }

    // Pheromone drag-painting
    if (input.isDragging && input.mode === InputMode.Pheromone && input.hoveredHex) {
      this.paintPheromone(input.hoveredHex.q, input.hoveredHex.r);
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (!this.world) return;
    const input = this.world.inputState;

    if (!this.firstClickFired) {
      this.firstClickFired = true;
      this.onFirstClick?.();
    }

    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      // Right click or ctrl+click = pan
      input.isPanning = true;
      input.lastMouseX = e.offsetX;
      input.lastMouseY = e.offsetY;
      return;
    }

    if (e.button === 0) {
      input.isDragging = true;
      const hovered = input.hoveredHex;
      if (!hovered) return;

      if (input.mode === InputMode.Select) {
        input.selectedHex = { q: hovered.q, r: hovered.r };
      } else if (input.mode === InputMode.Build) {
        this.tryBuild(hovered.q, hovered.r);
      } else if (input.mode === InputMode.Pheromone) {
        this.paintPheromone(hovered.q, hovered.r);
      }
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (!this.world) return;
    const input = this.world.inputState;
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      input.isPanning = false;
    }
    if (e.button === 0) {
      input.isDragging = false;
    }
  }

  private onMouseLeave() {
    if (!this.world) return;
    this.world.inputState.hoveredHex = null;
    this.world.inputState.isPanning = false;
    this.world.inputState.isDragging = false;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const dpr = this.getDpr();
    this.camera.zoomAt(e.offsetX * dpr, e.offsetY * dpr, e.deltaY);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.world) return;
    // Don't capture if user is interacting with input elements
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'Escape':
        this.setMode(InputMode.Select);
        break;
      case 'b':
      case 'B':
        this.setMode(InputMode.Build);
        break;
      case 'p':
      case 'P':
        this.setMode(InputMode.Pheromone);
        break;
      case ' ':
        e.preventDefault();
        this.togglePause();
        break;
      case '1':
        this.setSpeed(1);
        break;
      case '2':
        this.setSpeed(2);
        break;
      case '3':
        this.setSpeed(3);
        break;
    }
  }

  setMode(mode: InputMode) {
    if (!this.world) return;
    this.world.inputState.mode = mode;
    // Update UI buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });
    // Toggle build panel
    const buildPanel = document.getElementById('build-panel');
    if (buildPanel) {
      buildPanel.classList.toggle('visible', mode === InputMode.Build);
    }
  }

  private tryBuild(q: number, r: number) {
    const valid = this.getValidBuildHexes();
    const key = hexKey(q, r);
    if (!valid.has(key)) return;

    const cell = this.world.grid.get(q, r);
    if (!cell) return;

    const buildType = this.world.inputState.buildType;
    const cost = BUILD_COSTS[buildType];
    if (!cost) return;

    // Check resources and show feedback if insufficient
    if (this.world.resources.wax < cost.wax) {
      this.world.notification = `Need ${cost.wax} wax (have ${this.world.resources.wax.toFixed(1)})`;
      this.world.notificationTimer = 2;
      return;
    }
    if (cost.honey > 0 && this.world.resources.honey < cost.honey) {
      this.world.notification = `Need ${cost.honey} honey (have ${this.world.resources.honey.toFixed(1)})`;
      this.world.notificationTimer = 2;
      return;
    }

    // Deduct wax from global pool (not cell-stored)
    this.world.resources.wax -= cost.wax;
    // Deduct honey from storage cells so hive system recalculation stays consistent
    if (cost.honey > 0) {
      this.world.deductHoney(cost.honey);
    }

    // Place cell
    const terrainMap: Record<BuildType, TerrainType> = {
      honey_storage: TerrainType.HoneyStorage,
      processing: TerrainType.Processing,
      brood: TerrainType.Brood,
    };
    cell.terrain = terrainMap[buildType];
    cell.honeyStored = 0;
    cell.nectarStored = 0;
    cell.processingProgress = 0;
    cell.broodProgress = 0;
    cell.broodActive = false;

    // Trigger build sound
    this.world.pendingSounds.push('build');
  }

  private togglePause(): void {
    if (!this.world) return;
    this.world.settings.paused = !this.world.settings.paused;
    this.updateSpeedButtons();
  }

  private setSpeed(speed: number): void {
    if (!this.world) return;
    this.world.settings.paused = false;
    this.world.settings.speedMultiplier = speed;
    this.updateSpeedButtons();
  }

  private updateSpeedButtons(): void {
    const paused = this.world.settings.paused;
    const speed = this.world.settings.speedMultiplier;
    document.querySelectorAll('.speed-btn').forEach(btn => {
      const btnSpeed = parseInt((btn as HTMLElement).dataset.speed || '0');
      btn.classList.toggle('active', paused ? btnSpeed === 0 : btnSpeed === speed);
    });
  }

  private paintPheromone(q: number, r: number) {
    const cell = this.world.grid.get(q, r);
    if (!cell) return;
    cell.pheromone = Math.min(PHEROMONE_MAX, cell.pheromone + PHEROMONE_PAINT_AMOUNT);
  }
}
