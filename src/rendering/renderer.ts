import { Camera } from './camera';
import { renderHexGrid } from './hexRenderer';
import { renderEntities } from './entityRenderer';
import { World } from '../world/world';
import { InputMode } from '../types';
import { hexKey, hexNeighbors } from '../hex/hex';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera();
    this.handleResize();
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.camera.resize(rect.width * dpr, rect.height * dpr);
    // Scale for DPR so our world coordinates work in CSS pixels * dpr
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  render(world: World, tickAlpha: number) {
    const { ctx, camera } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear with sky/background color based on day progress
    const bgColor = this.getBackgroundColor(world.dayProgress);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Apply camera transform
    camera.applyTransform(ctx);

    // Compute valid build hexes if in build mode
    const buildMode = world.inputState.mode === InputMode.Build;
    const validBuildHexes = buildMode ? this.getValidBuildHexes(world) : new Set<string>();

    // Draw hex grid
    renderHexGrid(
      ctx,
      world,
      camera,
      world.inputState.hoveredHex,
      world.inputState.selectedHex,
      buildMode,
      validBuildHexes,
    );

    // Draw entities
    renderEntities(ctx, world.bees, camera, tickAlpha);
  }

  private getBackgroundColor(dayProgress: number): string {
    // Lerp from warm gold (day) to cool blue (night)
    // Day: 0.05 - 0.7, Night: 0.7 - 1.0, Dawn: 0.0 - 0.05
    let t: number; // 0=day, 1=night
    if (dayProgress < 0.05) {
      t = 1 - dayProgress / 0.05; // dawn: fading from night
    } else if (dayProgress < 0.65) {
      t = 0; // full day
    } else if (dayProgress < 0.7) {
      t = (dayProgress - 0.65) / 0.05; // dusk: fading to night
    } else {
      t = 1; // night
    }

    // Day: #87CEEB (sky blue), Night: #1a1a3e (dark blue)
    const r = Math.round(135 + (26 - 135) * t);
    const g = Math.round(206 + (26 - 206) * t);
    const b = Math.round(235 + (62 - 235) * t);
    return `rgb(${r},${g},${b})`;
  }

  getValidBuildHexes(world: World): Set<string> {
    const valid = new Set<string>();

    // Waystations can be placed on any explored grass hex
    if (world.inputState.buildType === 'waystation') {
      for (const cell of world.grid.cells.values()) {
        if (cell.explored && cell.terrain === 'grass') {
          valid.add(hexKey(cell.q, cell.r));
        }
      }
      return valid;
    }

    // Other buildings must be adjacent to existing hive cells
    const hive = world.grid.hiveCells();
    for (const cell of hive) {
      const neighbors = hexNeighbors(cell.q, cell.r);
      for (const n of neighbors) {
        const nc = world.grid.get(n.q, n.r);
        if (nc && nc.terrain === 'grass') {
          valid.add(hexKey(n.q, n.r));
        }
      }
    }

    // Honey/pollen storage can also be built adjacent to waystations
    if (world.inputState.buildType === 'honey_storage' || world.inputState.buildType === 'pollen_storage') {
      const waystations = world.grid.waystationCells();
      for (const ws of waystations) {
        const neighbors = hexNeighbors(ws.q, ws.r);
        for (const n of neighbors) {
          const nc = world.grid.get(n.q, n.r);
          if (nc && nc.terrain === 'grass') {
            valid.add(hexKey(n.q, n.r));
          }
        }
      }
    }

    return valid;
  }
}
