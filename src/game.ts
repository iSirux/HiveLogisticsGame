import { World } from './world/world';
import { generateWorld } from './world/worldGen';
import { Renderer } from './rendering/renderer';
import { InputHandler } from './input/inputHandler';
import { UIManager } from './ui/uiManager';
import { AudioManager } from './audio/audioManager';
import { updateMovement } from './systems/movementSystem';
import { updateForaging } from './systems/foragingSystem';
import { updateHive } from './systems/hiveSystem';
import { updatePheromones } from './systems/pheromoneSystem';
import { updateDayNight } from './systems/dayNightSystem';
import { SIM_TICK_MS, MAX_TICKS_PER_FRAME } from './constants';

export class Game {
  world: World;
  renderer: Renderer;
  inputHandler: InputHandler;
  uiManager: UIManager;
  audioManager: AudioManager;

  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new World();
    this.renderer = new Renderer(canvas);
    this.inputHandler = new InputHandler(canvas, this.renderer.camera);
    this.uiManager = new UIManager();
    this.audioManager = new AudioManager();

    // Wire up
    this.inputHandler.setWorld(this.world);
    this.inputHandler.setValidBuildHexesGetter(() => this.renderer.getValidBuildHexes(this.world));
    this.inputHandler.setFirstClickCallback(() => this.audioManager.init());
    this.uiManager.init(this.world, this.inputHandler);

    // Generate world
    generateWorld(this.world);

    // Handle resize
    window.addEventListener('resize', () => this.renderer.handleResize());
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

    // Render with interpolation alpha
    const tickAlpha = this.accumulator / SIM_TICK_MS;
    this.renderer.render(this.world, tickAlpha);

    // Update UI
    this.uiManager.update();

    // Audio
    const visibleBees = this.world.bees.filter(b =>
      this.renderer.camera.isVisible(b.pixelX, b.pixelY)
    ).length;
    this.audioManager.updateBuzz(visibleBees);
    this.audioManager.processEvents(this.world);

    requestAnimationFrame((t) => this.loop(t));
  }

  private tick(): void {
    this.world.tickCount++;

    // Run systems in order
    updateForaging(this.world);
    updateMovement(this.world);
    updateHive(this.world);
    updatePheromones(this.world);
    updateDayNight(this.world);
  }
}
