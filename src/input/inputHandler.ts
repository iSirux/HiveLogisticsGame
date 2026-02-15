import { Camera } from '../rendering/camera';
import { pixelToHex } from '../hex/hex';
import { World } from '../world/world';
import { InputMode, TerrainType, BuildType } from '../types';
import { BUILD_COSTS, PHEROMONE_PAINT_AMOUNT, PHEROMONE_MAX, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX } from '../constants';
import { hexKey } from '../hex/hex';

export class InputHandler {
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private world!: World;
  private getValidBuildHexes!: () => Set<string>;
  private onFirstClick: (() => void) | null = null;
  private firstClickFired = false;

  // Touch state
  private activeTouches = new Map<number, { x: number; y: number }>();
  private touchStartTime = 0;
  private touchStartPos = { x: 0, y: 0 };
  private touchMoved = false;
  private lastPinchDist = 0;

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

    // Touch events
    c.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    c.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    c.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    c.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
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
        // Auto-open build menu when selecting a buildable hex
        const valid = this.getValidBuildHexes();
        if (valid.has(hexKey(hovered.q, hovered.r))) {
          this.setMode(InputMode.Build);
        }
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

  tryBuild(q: number, r: number) {
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
      pollen_storage: TerrainType.PollenStorage,
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
    this.world.terrainVersion++;
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

  private getTouchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  private pinchDistance(): number {
    if (this.activeTouches.size < 2) return 0;
    const pts = Array.from(this.activeTouches.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private pinchCenter(): { x: number; y: number } {
    const pts = Array.from(this.activeTouches.values());
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (!this.world) return;

    if (!this.firstClickFired) {
      this.firstClickFired = true;
      this.onFirstClick?.();
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const pos = this.getTouchPos(t);
      this.activeTouches.set(t.identifier, pos);
    }

    if (this.activeTouches.size === 1) {
      const pos = Array.from(this.activeTouches.values())[0];
      this.touchStartTime = performance.now();
      this.touchStartPos = { x: pos.x, y: pos.y };
      this.touchMoved = false;
    }

    if (this.activeTouches.size === 2) {
      this.lastPinchDist = this.pinchDistance();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.world) return;
    const dpr = this.getDpr();
    const input = this.world.inputState;

    // Save previous positions for delta calculation
    const prevPositions = new Map<number, { x: number; y: number }>();
    for (const [id, pos] of this.activeTouches) {
      prevPositions.set(id, { x: pos.x, y: pos.y });
    }

    // Update positions
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const pos = this.getTouchPos(t);
      this.activeTouches.set(t.identifier, pos);
    }

    // Check movement threshold for tap detection
    if (this.activeTouches.size === 1) {
      const pos = Array.from(this.activeTouches.values())[0];
      const dx = pos.x - this.touchStartPos.x;
      const dy = pos.y - this.touchStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        this.touchMoved = true;
      }
    } else {
      this.touchMoved = true;
    }

    if (this.activeTouches.size === 1 && this.touchMoved) {
      // Single-finger drag
      const id = Array.from(this.activeTouches.keys())[0];
      const pos = this.activeTouches.get(id)!;
      const prev = prevPositions.get(id);
      if (prev) {
        if (input.mode === InputMode.Pheromone) {
          // Paint pheromones while dragging
          const sx = pos.x * dpr;
          const sy = pos.y * dpr;
          const wp = this.camera.screenToWorld(sx, sy);
          const hex = pixelToHex(wp.x, wp.y);
          if (this.world.grid.has(hex.q, hex.r)) {
            this.paintPheromone(hex.q, hex.r);
          }
        } else {
          // Pan camera
          const dx = (pos.x - prev.x) * dpr;
          const dy = (pos.y - prev.y) * dpr;
          this.camera.pan(dx, dy);
        }
      }
    } else if (this.activeTouches.size === 2) {
      // Two-finger pinch + pan
      const center = this.pinchCenter();
      const dist = this.pinchDistance();

      // Pan (use center movement)
      const prevIds = Array.from(prevPositions.keys()).filter(id => this.activeTouches.has(id));
      if (prevIds.length === 2) {
        const prevCenter = {
          x: (prevPositions.get(prevIds[0])!.x + prevPositions.get(prevIds[1])!.x) / 2,
          y: (prevPositions.get(prevIds[0])!.y + prevPositions.get(prevIds[1])!.y) / 2,
        };
        const dx = (center.x - prevCenter.x) * dpr;
        const dy = (center.y - prevCenter.y) * dpr;
        this.camera.pan(dx, dy);
      }

      // Pinch zoom
      if (this.lastPinchDist > 0 && dist > 0) {
        const ratio = dist / this.lastPinchDist;
        const sx = center.x * dpr;
        const sy = center.y * dpr;
        const worldBefore = this.camera.screenToWorld(sx, sy);
        this.camera.zoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, this.camera.zoom * ratio));
        const worldAfter = this.camera.screenToWorld(sx, sy);
        this.camera.x += worldBefore.x - worldAfter.x;
        this.camera.y += worldBefore.y - worldAfter.y;
      }
      this.lastPinchDist = dist;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.world) return;

    const input = this.world.inputState;
    const wasSingleTouch = this.activeTouches.size === 1;
    const elapsed = performance.now() - this.touchStartTime;

    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }

    // Tap detection: single touch, < 300ms, < 10px movement
    if (wasSingleTouch && this.activeTouches.size === 0 && !this.touchMoved && elapsed < 300) {
      const dpr = this.getDpr();
      const sx = this.touchStartPos.x * dpr;
      const sy = this.touchStartPos.y * dpr;
      const wp = this.camera.screenToWorld(sx, sy);
      const hex = pixelToHex(wp.x, wp.y);

      if (this.world.grid.has(hex.q, hex.r)) {
        if (input.mode === InputMode.Select) {
          input.selectedHex = { q: hex.q, r: hex.r };
          const valid = this.getValidBuildHexes();
          if (valid.has(hexKey(hex.q, hex.r))) {
            this.setMode(InputMode.Build);
          }
        } else if (input.mode === InputMode.Build) {
          this.tryBuild(hex.q, hex.r);
        } else if (input.mode === InputMode.Pheromone) {
          this.paintPheromone(hex.q, hex.r);
        }
      } else {
        // Tap empty area = deselect
        input.selectedHex = null;
      }
    }

    // Reset pinch distance when dropping below 2 touches
    if (this.activeTouches.size < 2) {
      this.lastPinchDist = 0;
    }
  }

  private paintPheromone(q: number, r: number) {
    const cell = this.world.grid.get(q, r);
    if (!cell) return;
    cell.pheromone = Math.min(PHEROMONE_MAX, cell.pheromone + PHEROMONE_PAINT_AMOUNT);
  }
}
