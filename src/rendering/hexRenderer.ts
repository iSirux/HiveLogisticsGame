import { HexCell, TerrainType } from '../types';
import { hexToPixel, hexCorners } from '../hex/hex';
import { Camera } from './camera';
import { HEX_SIZE, WAYSTATION_NECTAR_CAPACITY, WAYSTATION_POLLEN_CAPACITY } from '../constants';
import { World } from '../world/world';

const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.Grass]: '#4a7c3f',
  [TerrainType.Flower]: '#6b9e5a',
  [TerrainType.Tree]: '#2d5a2d',
  [TerrainType.Water]: '#3a7abd',
  [TerrainType.HiveEntrance]: '#b8862e',
  [TerrainType.HoneyStorage]: '#c49520',
  [TerrainType.PollenStorage]: '#a09030',
  [TerrainType.Processing]: '#7a6030',
  [TerrainType.Brood]: '#8c6a7a',
  [TerrainType.Empty]: '#4a4440',
  [TerrainType.Waystation]: '#7a6840',
};

const FOG_COLOR = '#15152a';

export function renderHexGrid(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  hoveredHex: { q: number; r: number } | null,
  selectedHex: { q: number; r: number } | null,
  buildMode: boolean,
  validBuildHexes: Set<string>,
) {
  const grid = world.grid;

  for (const cell of grid.cells.values()) {
    const { x: px, y: py } = hexToPixel(cell.q, cell.r);
    if (!camera.isVisible(px, py)) continue;

    // Unexplored cells: render as dark fog (unless debug fog disabled)
    if (!cell.explored && !world.debugFogDisabled) {
      drawFogHex(ctx, px, py);
      continue;
    }

    drawHex(ctx, cell, px, py);

    // Pheromone overlay
    if (cell.pheromone > 0.01) {
      drawPheromoneOverlay(ctx, px, py, cell.pheromone);
    }

    // Flower petals
    if (cell.terrain === TerrainType.Flower && cell.nectarAmount > 0) {
      drawFlower(ctx, px, py, cell);
    }

    // Tree graphic
    if (cell.terrain === TerrainType.Tree) {
      drawTree(ctx, px, py);
    }

    // Water graphic
    if (cell.terrain === TerrainType.Water) {
      drawWater(ctx, px, py);
    }

    // Hive building graphics
    if (cell.terrain === TerrainType.HiveEntrance) {
      drawHiveEntrance(ctx, px, py);
    }
    if (cell.terrain === TerrainType.HoneyStorage) {
      drawHoneyStorage(ctx, px, py, cell.honeyStored);
    }
    if (cell.terrain === TerrainType.PollenStorage) {
      drawPollenStorage(ctx, px, py, cell.pollenStored);
    }
    if (cell.terrain === TerrainType.Processing) {
      drawProcessing(ctx, px, py, cell.nectarStored);
    }
    if (cell.terrain === TerrainType.Brood) {
      drawBroodCell(ctx, px, py, cell.broodActive, cell.broodProgress);
    }
    if (cell.terrain === TerrainType.Waystation) {
      drawWaystation(ctx, px, py, cell);
    }
    if (cell.terrain === TerrainType.Empty) {
      drawEmptyCell(ctx, px, py);
    }
  }

  // Build mode: highlight valid hexes
  if (buildMode) {
    for (const key of validBuildHexes) {
      const [qs, rs] = key.split(',');
      const q = parseInt(qs);
      const r = parseInt(rs);
      const { x: px, y: py } = hexToPixel(q, r);
      if (!camera.isVisible(px, py)) continue;
      drawHexOutline(ctx, px, py, 'rgba(100, 255, 100, 0.4)', 2);
    }
  }

  // Hover highlight (only on explored hexes, or all when fog disabled)
  if (hoveredHex) {
    const hovCell = world.grid.get(hoveredHex.q, hoveredHex.r);
    if (hovCell && (hovCell.explored || world.debugFogDisabled)) {
      const { x: hx, y: hy } = hexToPixel(hoveredHex.q, hoveredHex.r);
      drawHexOutline(ctx, hx, hy, 'rgba(255, 255, 255, 0.6)', 2);
    }
  }

  // Selected highlight
  if (selectedHex) {
    const selCell = world.grid.get(selectedHex.q, selectedHex.r);
    if (selCell && (selCell.explored || world.debugFogDisabled)) {
      const { x: sx, y: sy } = hexToPixel(selectedHex.q, selectedHex.r);
      drawHexOutline(ctx, sx, sy, 'rgba(255, 220, 80, 0.8)', 3);
    }
  }
}

function drawHex(ctx: CanvasRenderingContext2D, cell: HexCell, cx: number, cy: number) {
  const corners = hexCorners(cx, cy);

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = TERRAIN_COLORS[cell.terrain];
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFogHex(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const corners = hexCorners(cx, cy);

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = FOG_COLOR;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,60,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHexOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, width: number) {
  const corners = hexCorners(cx, cy);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawPheromoneOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, strength: number) {
  const corners = hexCorners(cx, cy);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(255, 255, 80, ${strength * 0.35})`;
  ctx.fill();
}

function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  const petalCount = 5;
  const petalR = HEX_SIZE * 0.22;
  const centerR = HEX_SIZE * 0.12;
  const orbitR = HEX_SIZE * 0.3;

  const nectarAlpha = cell.nectarMax > 0 ? cell.nectarAmount / cell.nectarMax : 0;
  const alpha = 0.4 + nectarAlpha * 0.6;

  ctx.globalAlpha = alpha;
  for (let i = 0; i < petalCount; i++) {
    const angle = (Math.PI * 2 / petalCount) * i;
    const px = cx + Math.cos(angle) * orbitR;
    const py = cy + Math.sin(angle) * orbitR;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.fillStyle = cell.flowerColor;
    ctx.fill();
  }

  // Center
  ctx.beginPath();
  ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.globalAlpha = 1;

  // Pollen dots around center (small yellow dots)
  if (cell.pollenAmount > 0.01 && cell.pollenMax > 0) {
    const pollenAlpha = cell.pollenAmount / cell.pollenMax;
    ctx.globalAlpha = pollenAlpha * 0.8;
    const dotR = HEX_SIZE * 0.06;
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i + Math.PI / 6;
      const dx = cx + Math.cos(angle) * (centerR + dotR * 2);
      const dy = cy + Math.sin(angle) * (centerR + dotR * 2);
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe040';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Trunk
  const trunkW = HEX_SIZE * 0.08;
  const trunkH = HEX_SIZE * 0.35;
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx - trunkW / 2, cy - trunkH * 0.1, trunkW, trunkH);

  // Canopy
  ctx.beginPath();
  ctx.arc(cx, cy - trunkH * 0.3, HEX_SIZE * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#1e6e1e';
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.arc(cx - HEX_SIZE * 0.08, cy - trunkH * 0.4, HEX_SIZE * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100, 180, 60, 0.3)';
  ctx.fill();
}

function drawWater(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Subtle wave lines
  ctx.strokeStyle = 'rgba(100, 180, 240, 0.4)';
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    const y = cy + i * HEX_SIZE * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - HEX_SIZE * 0.4, y);
    ctx.quadraticCurveTo(cx - HEX_SIZE * 0.15, y - 3, cx, y);
    ctx.quadraticCurveTo(cx + HEX_SIZE * 0.15, y + 3, cx + HEX_SIZE * 0.4, y);
    ctx.stroke();
  }
}

function drawStorageBar(ctx: CanvasRenderingContext2D, cx: number, cy: number, amount: number, color: string) {
  const barW = HEX_SIZE * 0.8;
  const barH = 4;
  const fillRatio = Math.min(amount / 5, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - barW / 2, cy + HEX_SIZE * 0.4, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(cx - barW / 2, cy + HEX_SIZE * 0.4, barW * fillRatio, barH);
}

function drawHiveEntrance(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Arch/doorway shape
  const archW = HEX_SIZE * 0.5;
  const archH = HEX_SIZE * 0.55;
  const top = cy - archH * 0.3;
  const bottom = cy + archH * 0.5;

  // Dark opening
  ctx.beginPath();
  ctx.arc(cx, top + archW * 0.3, archW / 2, Math.PI, 0);
  ctx.lineTo(cx + archW / 2, bottom);
  ctx.lineTo(cx - archW / 2, bottom);
  ctx.closePath();
  ctx.fillStyle = '#3a2510';
  ctx.fill();

  // Arch border
  ctx.strokeStyle = '#e0b850';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Decorative rays above arch (like a sun/crown)
  ctx.strokeStyle = '#e0b850';
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    const angle = -Math.PI / 2 + i * 0.3;
    const x1 = cx + Math.cos(angle) * (archW * 0.4);
    const y1 = top - HEX_SIZE * 0.02 + Math.sin(angle) * (archW * 0.4);
    const x2 = cx + Math.cos(angle) * (archW * 0.65);
    const y2 = top - HEX_SIZE * 0.02 + Math.sin(angle) * (archW * 0.65);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawHoneyStorage(ctx: CanvasRenderingContext2D, cx: number, cy: number, honeyStored: number) {
  // Mini honeycomb pattern — 7 small hexagons
  const r = HEX_SIZE * 0.14;
  const gap = r * 1.85;
  const offsets = [
    { q: 0, r: 0 },
    { q: 1, r: 0 }, { q: -1, r: 0 },
    { q: 0.5, r: -1 }, { q: -0.5, r: -1 },
    { q: 0.5, r: 1 }, { q: -0.5, r: 1 },
  ];
  const fillRatio = Math.min(honeyStored / 5, 1);

  for (let i = 0; i < offsets.length; i++) {
    const ox = cx + offsets[i].q * gap;
    const oy = cy + offsets[i].r * gap * 0.87;
    // Fill cells from center outward based on storage amount
    const filled = i / offsets.length < fillRatio;

    ctx.beginPath();
    for (let c = 0; c < 6; c++) {
      const angle = Math.PI / 6 + (Math.PI * 2 / 6) * c;
      const hx = ox + Math.cos(angle) * r;
      const hy = oy + Math.sin(angle) * r;
      if (c === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#f0a820' : 'rgba(180, 140, 50, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#a07020';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  if (honeyStored > 0) {
    drawStorageBar(ctx, cx, cy, honeyStored, '#f0c040');
  }
}

function drawPollenStorage(ctx: CanvasRenderingContext2D, cx: number, cy: number, pollenStored: number) {
  // Cluster of pollen granules
  const granules = [
    { x: 0, y: -0.15, s: 0.18 },
    { x: -0.18, y: 0.08, s: 0.15 },
    { x: 0.18, y: 0.08, s: 0.15 },
    { x: 0, y: 0.2, s: 0.12 },
    { x: -0.1, y: -0.05, s: 0.1 },
    { x: 0.1, y: -0.05, s: 0.1 },
  ];
  const fillRatio = Math.min(pollenStored / 5, 1);

  for (let i = 0; i < granules.length; i++) {
    const g = granules[i];
    const filled = i / granules.length < fillRatio;
    ctx.beginPath();
    ctx.arc(cx + g.x * HEX_SIZE, cy + g.y * HEX_SIZE, g.s * HEX_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = filled ? '#e8c030' : 'rgba(160, 140, 50, 0.25)';
    ctx.fill();
    if (filled) {
      // Textured speckle on filled granules
      ctx.beginPath();
      ctx.arc(cx + g.x * HEX_SIZE - g.s * HEX_SIZE * 0.25, cy + g.y * HEX_SIZE - g.s * HEX_SIZE * 0.25, g.s * HEX_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 230, 100, 0.4)';
      ctx.fill();
    }
  }

  if (pollenStored > 0) {
    drawStorageBar(ctx, cx, cy, pollenStored, '#e0c020');
  }
}

function drawProcessing(ctx: CanvasRenderingContext2D, cx: number, cy: number, nectarStored: number) {
  // Swirl/spiral indicating processing
  const r = HEX_SIZE * 0.3;
  const turns = 1.8;
  ctx.beginPath();
  ctx.strokeStyle = nectarStored > 0 ? '#90d060' : 'rgba(120, 160, 60, 0.35)';
  ctx.lineWidth = 2;
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.1) {
    const frac = t / (turns * Math.PI * 2);
    const sr = r * frac;
    const sx = cx + Math.cos(t - Math.PI / 2) * sr;
    const sy = cy + Math.sin(t - Math.PI / 2) * sr;
    if (t === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Droplet at center
  const dropR = HEX_SIZE * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, dropR, 0, Math.PI * 2);
  ctx.fillStyle = nectarStored > 0 ? '#a0e060' : 'rgba(120, 160, 60, 0.3)';
  ctx.fill();

  // Small arrow tips at spiral end to suggest motion
  const endAngle = turns * Math.PI * 2 - Math.PI / 2;
  const endX = cx + Math.cos(endAngle) * r;
  const endY = cy + Math.sin(endAngle) * r;
  ctx.beginPath();
  ctx.arc(endX, endY, HEX_SIZE * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = nectarStored > 0 ? '#90d060' : 'rgba(120, 160, 60, 0.35)';
  ctx.fill();

  if (nectarStored > 0) {
    drawStorageBar(ctx, cx, cy, nectarStored, '#80d040');
  }
}

function drawBroodCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, broodActive: boolean, broodProgress: number) {
  // Egg/larva shape
  const eggW = HEX_SIZE * 0.2;
  const eggH = HEX_SIZE * 0.32;

  ctx.beginPath();
  ctx.ellipse(cx, cy, eggW, eggH, 0, 0, Math.PI * 2);
  ctx.fillStyle = broodActive ? '#f5e8c8' : 'rgba(180, 160, 120, 0.3)';
  ctx.fill();
  ctx.strokeStyle = broodActive ? '#c0a060' : 'rgba(150, 130, 90, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (broodActive) {
    // Highlight on egg
    ctx.beginPath();
    ctx.ellipse(cx - eggW * 0.25, cy - eggH * 0.2, eggW * 0.35, eggH * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 250, 230, 0.4)';
    ctx.fill();

    // Progress ring
    if (broodProgress > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, HEX_SIZE * 0.38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * broodProgress);
      ctx.strokeStyle = '#ffe080';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

function drawWaystation(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  // Small hex platform
  const r = HEX_SIZE * 0.35;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const hx = cx + Math.cos(angle) * r;
    const hy = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = '#9a8850';
  ctx.fill();
  ctx.strokeStyle = '#c0a860';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Relay arrow symbol (two arrows pointing in/out)
  ctx.strokeStyle = '#e0c870';
  ctx.lineWidth = 2;
  // Arrow right
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.lineTo(cx + 1, cy - 3);
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 1, cy + 3);
  ctx.stroke();

  // Storage bars (nectar + pollen)
  const barW = HEX_SIZE * 0.7;
  const barH = 3;
  const nectarFill = Math.min(cell.nectarStored / WAYSTATION_NECTAR_CAPACITY, 1);
  const pollenFill = Math.min(cell.pollenStored / WAYSTATION_POLLEN_CAPACITY, 1);

  // Nectar bar
  const barY1 = cy + HEX_SIZE * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - barW / 2, barY1, barW, barH);
  if (nectarFill > 0) {
    ctx.fillStyle = '#80d040';
    ctx.fillRect(cx - barW / 2, barY1, barW * nectarFill, barH);
  }

  // Pollen bar
  const barY2 = barY1 + barH + 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - barW / 2, barY2, barW, barH);
  if (pollenFill > 0) {
    ctx.fillStyle = '#e0c020';
    ctx.fillRect(cx - barW / 2, barY2, barW * pollenFill, barH);
  }
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Subtle scaffold lines to show it's buildable
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.25)';
  ctx.lineWidth = 0.8;
  // Dashed cross pattern
  const s = HEX_SIZE * 0.25;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx + s, cy);
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.stroke();
  ctx.setLineDash([]);
}
