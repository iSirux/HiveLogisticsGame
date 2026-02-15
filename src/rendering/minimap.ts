import { Camera } from './camera';
import { World } from '../world/world';
import { TerrainType, BeeRole, Biome } from '../types';
import { hexToPixel } from '../hex/hex';
import { MINIMAP_WIDTH, MINIMAP_HEIGHT, HEX_SIZE, FLOWER_TYPE_CONFIG } from '../constants';

const BIOME_GRASS_COLORS: Record<Biome, string> = {
  meadow: '#4a7c3f',
  forest: '#3a5c30',
  wetland: '#3a6a4a',
  wilds: '#5a6a3a',
};

const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.Grass]: '#4a7c3f',
  [TerrainType.Flower]: '#6b9e5a',
  [TerrainType.Tree]: '#2d5a2d',
  [TerrainType.Water]: '#3a7abd',
  [TerrainType.HiveEntrance]: '#c8a040',
  [TerrainType.HoneyStorage]: '#d4a830',
  [TerrainType.PollenStorage]: '#d4b830',
  [TerrainType.Processing]: '#b89030',
  [TerrainType.Brood]: '#c49040',
  [TerrainType.Empty]: '#333333',
  [TerrainType.Waystation]: '#7a6840',
  [TerrainType.WaxWorks]: '#8a7a40',
  [TerrainType.NectarStorage]: '#b08830',
};

const FOG_COLOR = '#15152a';

const BEE_COLORS: Record<BeeRole, string> = {
  [BeeRole.Forager]: '#ffd700',
  [BeeRole.Nurse]: '#ffffff',
  [BeeRole.Scout]: '#5599ff',
  [BeeRole.Hauler]: '#a080d0',
  [BeeRole.Builder]: '#d2b48c',
};

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrainCanvas: HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D;
  private camera: Camera;

  // World bounds in pixels
  private worldCenterX: number;
  private worldCenterY: number;
  private scale: number;
  private offsetX: number;
  private offsetY: number;

  // Cache invalidation
  private cachedTerrainVersion = -1;
  private cachedExplorationVersion = -1;

  // Click-to-pan state
  private dragging = false;

  constructor(container: HTMLElement, camera: Camera) {
    this.camera = camera;

    // Create minimap canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.style.position = 'absolute';
    this.canvas.style.bottom = '12px';
    this.canvas.style.left = '12px';
    this.canvas.style.width = MINIMAP_WIDTH + 'px';
    this.canvas.style.height = MINIMAP_HEIGHT + 'px';
    this.canvas.style.background = 'rgba(15, 15, 30, 0.8)';
    this.canvas.style.border = '1px solid rgba(200, 160, 60, 0.4)';
    this.canvas.style.borderRadius = '6px';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.zIndex = '5';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    // Offscreen terrain canvas
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;

    // Initial layout with default bounds
    this.worldCenterX = 0;
    this.worldCenterY = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.handleResize();
    this.bindEvents();
  }

  private computeLayoutFromWorld(world: World) {
    // Compute bounds from explored cells
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const cell of world.grid.cells.values()) {
      if (!cell.explored && !world.debugFogDisabled) continue;
      const { x, y } = hexToPixel(cell.q, cell.r);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    if (minX === Infinity) {
      // Fallback: small area around origin
      minX = -HEX_SIZE * 10;
      maxX = HEX_SIZE * 10;
      minY = -HEX_SIZE * 10;
      maxY = HEX_SIZE * 10;
    }

    const worldHalfW = (maxX - minX) / 2 + HEX_SIZE * 2;
    const worldHalfH = (maxY - minY) / 2 + HEX_SIZE * 2;
    this.worldCenterX = (minX + maxX) / 2;
    this.worldCenterY = (minY + maxY) / 2;

    const dpr = window.devicePixelRatio || 1;
    const cw = MINIMAP_WIDTH * dpr;
    const ch = MINIMAP_HEIGHT * dpr;
    const scaleX = cw / (worldHalfW * 2);
    const scaleY = ch / (worldHalfH * 2);
    this.scale = Math.min(scaleX, scaleY) * 0.9;
    this.offsetX = cw / 2 - this.worldCenterX * this.scale;
    this.offsetY = ch / 2 - this.worldCenterY * this.scale;
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = MINIMAP_WIDTH * dpr;
    this.canvas.height = MINIMAP_HEIGHT * dpr;
    this.terrainCanvas.width = this.canvas.width;
    this.terrainCanvas.height = this.canvas.height;

    // Force terrain redraw
    this.cachedTerrainVersion = -1;
    this.cachedExplorationVersion = -1;
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.dragging = true;
      this.panToClick(e.offsetX, e.offsetY);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        e.stopPropagation();
        this.panToClick(e.offsetX, e.offsetY);
      }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      this.dragging = false;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.dragging = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.panToClick(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.dragging) {
        const rect = this.canvas.getBoundingClientRect();
        const t = e.touches[0];
        this.panToClick(t.clientX - rect.left, t.clientY - rect.top);
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = false;
    }, { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.dragging = false;
    }, { passive: false });
  }

  private panToClick(cx: number, cy: number) {
    const dpr = window.devicePixelRatio || 1;
    const mx = cx * dpr;
    const my = cy * dpr;
    const wx = (mx - this.offsetX) / this.scale;
    const wy = (my - this.offsetY) / this.scale;
    this.camera.x = wx;
    this.camera.y = wy;
  }

  private worldToMinimap(wx: number, wy: number): { mx: number; my: number } {
    return {
      mx: wx * this.scale + this.offsetX,
      my: wy * this.scale + this.offsetY,
    };
  }

  private rebuildTerrain(world: World) {
    // Recompute layout based on current explored bounds
    this.computeLayoutFromWorld(world);

    const ctx = this.terrainCtx;
    const w = this.terrainCanvas.width;
    const h = this.terrainCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const dotR = Math.max(1.5, this.scale * HEX_SIZE * 0.6);

    for (const cell of world.grid.cells.values()) {
      const { x: px, y: py } = hexToPixel(cell.q, cell.r);
      const { mx, my } = this.worldToMinimap(px, py);

      // Skip cells far outside minimap canvas
      if (mx < -dotR || mx > w + dotR || my < -dotR || my > h + dotR) continue;

      ctx.beginPath();
      ctx.arc(mx, my, dotR, 0, Math.PI * 2);
      let color: string;
      if (!cell.explored && !world.debugFogDisabled) {
        color = FOG_COLOR;
      } else if (cell.terrain === TerrainType.Flower) {
        color = FLOWER_TYPE_CONFIG[cell.flowerType].color;
      } else if (cell.terrain === TerrainType.Grass) {
        color = BIOME_GRASS_COLORS[cell.biome] || BIOME_GRASS_COLORS.meadow;
      } else {
        color = TERRAIN_COLORS[cell.terrain];
      }
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  render(world: World, _camera: Camera, _tickAlpha: number) {
    // Check if terrain cache needs rebuild
    if (
      world.terrainVersion !== this.cachedTerrainVersion ||
      world.explorationVersion !== this.cachedExplorationVersion
    ) {
      this.rebuildTerrain(world);
      this.cachedTerrainVersion = world.terrainVersion;
      this.cachedExplorationVersion = world.explorationVersion;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear and draw cached terrain
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.terrainCanvas, 0, 0);

    // Draw bee dots
    for (const bee of world.bees) {
      const { mx, my } = this.worldToMinimap(bee.pixelX, bee.pixelY);
      ctx.fillStyle = BEE_COLORS[bee.role];
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

    // Draw camera viewport rectangle
    const cam = this.camera;
    const halfW = cam.width / 2 / cam.zoom;
    const halfH = cam.height / 2 / cam.zoom;
    const topLeft = this.worldToMinimap(cam.x - halfW, cam.y - halfH);
    const botRight = this.worldToMinimap(cam.x + halfW, cam.y + halfH);
    const rectW = botRight.mx - topLeft.mx;
    const rectH = botRight.my - topLeft.my;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(topLeft.mx, topLeft.my, rectW, rectH);
  }
}
