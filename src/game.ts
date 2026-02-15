import { World } from './world/world';
import { generateWorld } from './world/worldGen';
import { Renderer } from './rendering/renderer';
import { InputHandler } from './input/inputHandler';
import { UIManager } from './ui/uiManager';
import { AudioManager } from './audio/audioManager';
import { updateMovement } from './systems/movementSystem';
import { updateForaging } from './systems/foragingSystem';
import { updateHive } from './systems/hiveSystem';
import { updateDayNight } from './systems/dayNightSystem';
import { updateExploration } from './systems/explorationSystem';
import { updateLifecycle } from './systems/lifecycleSystem';
import { Minimap } from './rendering/minimap';
import { SIM_TICK_MS, MAX_TICKS_PER_FRAME } from './constants';
import { getLatestSave, restoreWorld, saveToSlot } from './storage/saveManager';

export class Game {
  world: World;
  renderer: Renderer;
  inputHandler: InputHandler;
  uiManager: UIManager;
  audioManager: AudioManager;
  minimap: Minimap;

  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new World();
    this.renderer = new Renderer(canvas);
    this.inputHandler = new InputHandler(canvas, this.renderer.camera);
    this.uiManager = new UIManager();
    this.audioManager = new AudioManager();
    this.minimap = new Minimap(document.getElementById('game-container')!, this.renderer.camera);

    // Wire up
    this.inputHandler.setWorld(this.world);
    this.inputHandler.setValidBuildHexesGetter(() => this.renderer.getValidBuildHexes(this.world));
    this.inputHandler.setFirstClickCallback(() => this.audioManager.init());
    this.uiManager.init(this.world, this.inputHandler);
    this.uiManager.setGameCallbacks(
      () => this.save(),
      () => this.newGame(),
    );

    // Load latest save or generate fresh world
    const latestSave = getLatestSave();
    if (latestSave) {
      restoreWorld(this.world, latestSave, this.renderer.camera);
      this.uiManager.syncFromWorld();
    } else {
      generateWorld(this.world);
    }

    // Handle resize
    const onResize = () => {
      this.renderer.handleResize();
      this.minimap.handleResize();
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    // Volume slider
    const volSlider = document.getElementById('volume-slider') as HTMLInputElement;
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        this.audioManager.setVolume(parseInt(volSlider.value) / 100);
      });
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(now: number): void {
    if (!this.running) return;

    const dt = now - this.lastTime;
    this.lastTime = now;

    // Accumulate time for fixed-step sim
    if (!this.world.settings.paused) {
      this.accumulator += dt * this.world.settings.speedMultiplier;
    }

    // Cap accumulator
    const maxAccum = SIM_TICK_MS * MAX_TICKS_PER_FRAME;
    if (this.accumulator > maxAccum) {
      this.accumulator = maxAccum;
    }

    // Run simulation ticks
    while (this.accumulator >= SIM_TICK_MS) {
      this.accumulator -= SIM_TICK_MS;
      this.tick();
    }

    // Keyboard camera pan
    this.inputHandler.update(dt / 1000);

    // Update camera bounds from world (unbound when fog is disabled)
    const cam = this.renderer.camera;
    if (this.world.debugFogDisabled) {
      cam.updateBounds(-Infinity, Infinity, -Infinity, Infinity);
    } else {
      cam.updateBounds(
        this.world.worldBoundsMinX,
        this.world.worldBoundsMaxX,
        this.world.worldBoundsMinY,
        this.world.worldBoundsMaxY,
      );
      cam.clampToBounds();
    }

    // Render with interpolation alpha
    const tickAlpha = this.accumulator / SIM_TICK_MS;
    this.renderer.render(this.world, tickAlpha);
    this.minimap.render(this.world, this.renderer.camera, tickAlpha);

    // Update UI
    this.uiManager.update();

    // Audio
    this.audioManager.processEvents(this.world);

    requestAnimationFrame((t) => this.loop(t));
  }

  private tick(): void {
    this.world.tickCount++;

    // Run systems in order
    updateForaging(this.world);
    updateLifecycle(this.world);
    updateMovement(this.world);
    updateHive(this.world);
    updateDayNight(this.world);
    updateExploration(this.world);

    // Autosave every 300 ticks (~30s at 1x)
    if (this.world.tickCount % 300 === 0) {
      saveToSlot(this.world, 'autosave', this.renderer.camera);
      this.showSaveIndicator();
    }
  }

  /** Save to a named slot */
  save(slotName = 'manual'): void {
    saveToSlot(this.world, slotName, this.renderer.camera);
    this.showSaveIndicator();
  }

  /** Start a fresh game (does not delete old saves) */
  newGame(): void {
    this.world = new World();
    this.inputHandler.setWorld(this.world);
    this.uiManager.init(this.world, this.inputHandler);
    generateWorld(this.world);
  }

  private showSaveIndicator(): void {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 1500);
  }
}
