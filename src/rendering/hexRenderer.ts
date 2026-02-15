import { HexCell, TerrainType, FlowerType, Biome } from '../types';
import { hexToPixel, hexPath } from '../hex/hex';
import { Camera } from './camera';
import { HEX_SIZE, WAYSTATION_NECTAR_CAPACITY, WAYSTATION_POLLEN_CAPACITY, WAX_WORKS_HONEY_CAPACITY, NECTAR_CELL_CAPACITY, HONEY_STORAGE_CAPACITY, POLLEN_STORAGE_CAPACITY, NECTAR_STORAGE_CAPACITY } from '../constants';
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
  [TerrainType.WaxWorks]: '#8a7a40',
  [TerrainType.NectarStorage]: '#b08830',
};

const BIOME_GRASS_COLORS: Record<Biome, string> = {
  meadow: '#4a7c3f',
  forest: '#3a5c30',
  wetland: '#3a6a4a',
  wilds: '#5a6a3a',
};

const BIOME_FLOWER_BASE: Record<Biome, string> = {
  meadow: '#6b9e5a',
  forest: '#4a7a3a',
  wetland: '#4a8a5a',
  wilds: '#6a8a4a',
};

const FOG_COLOR = '#15152a';

/** LOD thresholds */
const LOD_DETAIL_ZOOM = 0.55;   // below this: skip all decorations
const LOD_MEDIUM_ZOOM = 0.8;    // below this: skip biome decor & storage bars

/** Get the fill color for a hex cell */
function getHexColor(cell: HexCell): string {
  if (cell.terrain === TerrainType.Grass) {
    return BIOME_GRASS_COLORS[cell.biome] || BIOME_GRASS_COLORS.meadow;
  } else if (cell.terrain === TerrainType.Flower) {
    return BIOME_FLOWER_BASE[cell.biome] || BIOME_FLOWER_BASE.meadow;
  }
  return TERRAIN_COLORS[cell.terrain];
}

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
  const zoom = camera.zoom;
  const showFog = !world.debugFogDisabled;
  const drawDetails = zoom >= LOD_DETAIL_ZOOM;
  const drawMedium = zoom >= LOD_MEDIUM_ZOOM;

  // --- Pass 1: Bucket visible cells by fill color for batched rendering ---
  const colorBuckets = new Map<string, { cx: number; cy: number }[]>();
  const fogCells: { cx: number; cy: number }[] = [];
  // Detail cells need per-cell decoration in pass 2
  const detailCells: { cell: HexCell; cx: number; cy: number }[] = [];

  for (const cell of grid.cells.values()) {
    const { x: px, y: py } = hexToPixel(cell.q, cell.r);
    if (!camera.isVisible(px, py)) continue;

    if (!cell.explored && showFog) {
      fogCells.push({ cx: px, cy: py });
      continue;
    }

    const color = getHexColor(cell);
    let bucket = colorBuckets.get(color);
    if (!bucket) {
      bucket = [];
      colorBuckets.set(color, bucket);
    }
    bucket.push({ cx: px, cy: py });

    // Only queue for detail drawing if zoom warrants it and cell has decorations
    if (drawDetails && cell.terrain !== TerrainType.Grass) {
      detailCells.push({ cell, cx: px, cy: py });
    } else if (drawDetails && drawMedium && cell.terrain === TerrainType.Grass) {
      // Biome decor only at medium+ zoom
      detailCells.push({ cell, cx: px, cy: py });
    } else if (drawDetails && cell.terrain === TerrainType.Grass) {
      // Between LOD_DETAIL and LOD_MEDIUM: skip biome decor on grass (it's tiny)
    }
  }

  // --- Pass 2: Batched hex fills (one path per color) ---
  for (const [color, cells] of colorBuckets) {
    ctx.beginPath();
    for (const { cx, cy } of cells) {
      hexPath(ctx, cx, cy);
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Batched grid lines (single stroke for all explored hexes)
  ctx.beginPath();
  for (const cells of colorBuckets.values()) {
    for (const { cx, cy } of cells) {
      hexPath(ctx, cx, cy);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Batched fog hexes
  if (fogCells.length > 0) {
    ctx.beginPath();
    for (const { cx, cy } of fogCells) {
      hexPath(ctx, cx, cy);
    }
    ctx.fillStyle = FOG_COLOR;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,60,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // --- Pass 3: Per-cell decorations (LOD-gated) ---
  if (drawDetails) {
    for (const { cell, cx, cy } of detailCells) {
      switch (cell.terrain) {
        case TerrainType.Grass:
          if (drawMedium) drawBiomeDecor(ctx, cx, cy, cell);
          break;
        case TerrainType.Flower:
          drawFlower(ctx, cx, cy, cell);
          break;
        case TerrainType.Tree:
          drawTree(ctx, cx, cy);
          break;
        case TerrainType.Water:
          drawWater(ctx, cx, cy);
          break;
        case TerrainType.HiveEntrance:
          drawHiveEntrance(ctx, cx, cy);
          break;
        case TerrainType.HoneyStorage:
          drawHoneyStorage(ctx, cx, cy, cell.honeyStored);
          break;
        case TerrainType.PollenStorage:
          drawPollenStorage(ctx, cx, cy, cell.pollenStored);
          break;
        case TerrainType.Processing:
          drawProcessing(ctx, cx, cy, cell.nectarStored);
          break;
        case TerrainType.Brood:
          drawBroodCell(ctx, cx, cy, cell.broodActive, cell.broodProgress);
          break;
        case TerrainType.Waystation:
          drawWaystation(ctx, cx, cy, cell);
          break;
        case TerrainType.WaxWorks:
          drawWaxWorks(ctx, cx, cy, cell);
          break;
        case TerrainType.NectarStorage:
          drawNectarStorage(ctx, cx, cy, cell);
          break;
        case TerrainType.Empty:
          drawEmptyCell(ctx, cx, cy);
          break;
      }
    }
  }

  // Build mode: highlight valid hexes
  if (buildMode) {
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const key of validBuildHexes) {
      const [qs, rs] = key.split(',');
      const q = parseInt(qs);
      const r = parseInt(rs);
      const { x: px, y: py } = hexToPixel(q, r);
      if (!camera.isVisible(px, py)) continue;
      hexPath(ctx, px, py);
    }
    ctx.stroke();
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

/** Deterministic hash for decoration placement (matches procgen hashCoord) */
function decorHash(q: number, r: number, channel: number): number {
  let h = channel | 0;
  h = (Math.imul(h ^ (q * 374761393), 1103515245) + 12345) | 0;
  h = (Math.imul(h ^ (r * 668265263), 1103515245) + 12345) | 0;
  h = (h ^ (h >>> 15)) | 0;
  h = Math.imul(h, 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 3266489917) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0) / 4294967296;
}

function drawBiomeDecor(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  const q = cell.q;
  const r = cell.r;

  switch (cell.biome) {
    case 'meadow': {
      // Small grass tufts — 2-3 short lines
      const count = 2 + Math.floor(decorHash(q, r, 0xD001) * 2);
      ctx.strokeStyle = 'rgba(90, 160, 60, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const ox = (decorHash(q, r, 0xD010 + i) - 0.5) * HEX_SIZE * 0.7;
        const oy = (decorHash(q, r, 0xD020 + i) - 0.5) * HEX_SIZE * 0.6;
        const h = HEX_SIZE * 0.12 + decorHash(q, r, 0xD030 + i) * HEX_SIZE * 0.08;
        const lean = (decorHash(q, r, 0xD040 + i) - 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + oy);
        ctx.lineTo(cx + ox + lean, cy + oy - h);
        ctx.stroke();
      }
      break;
    }
    case 'forest': {
      // Leaf litter — small scattered dots
      const count = 2 + Math.floor(decorHash(q, r, 0xD002) * 3);
      for (let i = 0; i < count; i++) {
        const ox = (decorHash(q, r, 0xD050 + i) - 0.5) * HEX_SIZE * 0.7;
        const oy = (decorHash(q, r, 0xD060 + i) - 0.5) * HEX_SIZE * 0.6;
        const shade = decorHash(q, r, 0xD070 + i);
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, HEX_SIZE * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = shade < 0.5 ? 'rgba(80, 50, 20, 0.4)' : 'rgba(50, 80, 30, 0.35)';
        ctx.fill();
      }
      break;
    }
    case 'wetland': {
      // Short reed marks — vertical dashes
      const count = 1 + Math.floor(decorHash(q, r, 0xD003) * 2);
      ctx.strokeStyle = 'rgba(60, 100, 70, 0.45)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < count; i++) {
        const ox = (decorHash(q, r, 0xD080 + i) - 0.5) * HEX_SIZE * 0.6;
        const oy = (decorHash(q, r, 0xD090 + i) - 0.5) * HEX_SIZE * 0.5;
        const h = HEX_SIZE * 0.15 + decorHash(q, r, 0xD0A0 + i) * HEX_SIZE * 0.1;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + oy);
        ctx.lineTo(cx + ox, cy + oy - h);
        ctx.stroke();
      }
      // Faint puddle sheen
      if (decorHash(q, r, 0xD0B0) < 0.3) {
        ctx.beginPath();
        ctx.arc(cx + (decorHash(q, r, 0xD0C0) - 0.5) * HEX_SIZE * 0.4, cy + (decorHash(q, r, 0xD0D0) - 0.5) * HEX_SIZE * 0.4, HEX_SIZE * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(60, 120, 140, 0.15)';
        ctx.fill();
      }
      break;
    }
    case 'wilds': {
      // Small rock specks
      const count = 1 + Math.floor(decorHash(q, r, 0xD004) * 2);
      for (let i = 0; i < count; i++) {
        const ox = (decorHash(q, r, 0xD0E0 + i) - 0.5) * HEX_SIZE * 0.6;
        const oy = (decorHash(q, r, 0xD0F0 + i) - 0.5) * HEX_SIZE * 0.5;
        const sz = HEX_SIZE * 0.05 + decorHash(q, r, 0xD100 + i) * HEX_SIZE * 0.04;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, sz, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120, 110, 80, 0.45)';
        ctx.fill();
      }
      // Sparse dry grass tuft
      if (decorHash(q, r, 0xD110) < 0.4) {
        const ox = (decorHash(q, r, 0xD120) - 0.5) * HEX_SIZE * 0.5;
        const oy = (decorHash(q, r, 0xD130) - 0.5) * HEX_SIZE * 0.4;
        ctx.strokeStyle = 'rgba(140, 130, 70, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + oy);
        ctx.lineTo(cx + ox - 2, cy + oy - HEX_SIZE * 0.1);
        ctx.moveTo(cx + ox, cy + oy);
        ctx.lineTo(cx + ox + 2, cy + oy - HEX_SIZE * 0.12);
        ctx.stroke();
      }
      break;
    }
  }
}

function drawHexOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, width: number) {
  ctx.beginPath();
  hexPath(ctx, cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  const nectarAlpha = cell.nectarMax > 0 ? cell.nectarAmount / cell.nectarMax : 0;
  const alpha = 0.4 + nectarAlpha * 0.6;
  ctx.globalAlpha = alpha;

  switch (cell.flowerType) {
    case FlowerType.Clover:
      drawClover(ctx, cx, cy, cell.flowerColor);
      break;
    case FlowerType.Wildflower:
      drawWildflower(ctx, cx, cy, cell.flowerColor);
      break;
    case FlowerType.Sunflower:
      drawSunflower(ctx, cx, cy, cell.flowerColor);
      break;
    case FlowerType.Bluebell:
      drawBluebell(ctx, cx, cy, cell.flowerColor);
      break;
    case FlowerType.Honeysuckle:
      drawHoneysuckle(ctx, cx, cy, cell.flowerColor);
      break;
    default:
      drawWildflower(ctx, cx, cy, cell.flowerColor);
      break;
  }

  ctx.globalAlpha = 1;

  // Pollen dots around center (only for types with pollen)
  if (cell.pollenAmount > 0.01 && cell.pollenMax > 0) {
    const pollenAlpha = cell.pollenAmount / cell.pollenMax;
    ctx.globalAlpha = pollenAlpha * 0.8;
    const dotR = HEX_SIZE * 0.06;
    const centerR = HEX_SIZE * 0.12;
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

function drawClover(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // 3 round overlapping petals
  const petalR = HEX_SIZE * 0.2;
  const orbitR = HEX_SIZE * 0.18;
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * orbitR;
    const py = cy + Math.sin(angle) * orbitR;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Small center
  ctx.beginPath();
  ctx.arc(cx, cy, HEX_SIZE * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#90c060';
  ctx.fill();
}

function drawWildflower(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // 5 petals (original style)
  const petalR = HEX_SIZE * 0.22;
  const orbitR = HEX_SIZE * 0.3;
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i;
    const px = cx + Math.cos(angle) * orbitR;
    const py = cy + Math.sin(angle) * orbitR;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Center
  ctx.beginPath();
  ctx.arc(cx, cy, HEX_SIZE * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
}

function drawSunflower(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Large brown center disk
  const diskR = HEX_SIZE * 0.22;
  // 10 small pointed petals around it
  const petalR = HEX_SIZE * 0.14;
  const orbitR = HEX_SIZE * 0.35;
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 / 10) * i;
    const px = cx + Math.cos(angle) * orbitR;
    const py = cy + Math.sin(angle) * orbitR;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Dark center
  ctx.beginPath();
  ctx.arc(cx, cy, diskR, 0, Math.PI * 2);
  ctx.fillStyle = '#6b4400';
  ctx.fill();
  // Highlight ring
  ctx.beginPath();
  ctx.arc(cx, cy, diskR * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5a00';
  ctx.fill();
}

function drawBluebell(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // 3 drooping bell-shaped petals
  const bellH = HEX_SIZE * 0.28;
  const bellW = HEX_SIZE * 0.18;
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i + Math.PI / 6;
    const bx = cx + Math.cos(angle) * HEX_SIZE * 0.2;
    const by = cy + Math.sin(angle) * HEX_SIZE * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx, by - bellH * 0.3);
    ctx.quadraticCurveTo(bx + bellW, by + bellH * 0.3, bx, by + bellH * 0.5);
    ctx.quadraticCurveTo(bx - bellW, by + bellH * 0.3, bx, by - bellH * 0.3);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Small stem dot at center
  ctx.beginPath();
  ctx.arc(cx, cy, HEX_SIZE * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#3a6a20';
  ctx.fill();
}

function drawHoneysuckle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // 3 trumpet/tubular curves from center
  ctx.lineWidth = HEX_SIZE * 0.08;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const ex = cx + Math.cos(angle) * HEX_SIZE * 0.38;
    const ey = cy + Math.sin(angle) * HEX_SIZE * 0.38;
    const cpx = cx + Math.cos(angle + 0.4) * HEX_SIZE * 0.25;
    const cpy = cy + Math.sin(angle + 0.4) * HEX_SIZE * 0.25;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
    ctx.stroke();
    // Flared tip
    ctx.beginPath();
    ctx.arc(ex, ey, HEX_SIZE * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, HEX_SIZE * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#c8a850';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';
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

function drawStorageBar(ctx: CanvasRenderingContext2D, cx: number, cy: number, amount: number, max: number, color: string) {
  const barW = HEX_SIZE * 0.8;
  const barH = 4;
  const fillRatio = max > 0 ? Math.min(amount / max, 1) : 0;
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
  const fillRatio = Math.min(honeyStored / HONEY_STORAGE_CAPACITY, 1);

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
    ctx.fillStyle = filled ? '#f0a820' : 'rgba(80, 60, 20, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#a07020';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  drawStorageBar(ctx, cx, cy, honeyStored, HONEY_STORAGE_CAPACITY, '#f0c040');
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
  const fillRatio = Math.min(pollenStored / POLLEN_STORAGE_CAPACITY, 1);

  for (let i = 0; i < granules.length; i++) {
    const g = granules[i];
    const filled = i / granules.length < fillRatio;
    ctx.beginPath();
    ctx.arc(cx + g.x * HEX_SIZE, cy + g.y * HEX_SIZE, g.s * HEX_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = filled ? '#e8c030' : 'rgba(80, 70, 30, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#c0a830';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (filled) {
      // Textured speckle on filled granules
      ctx.beginPath();
      ctx.arc(cx + g.x * HEX_SIZE - g.s * HEX_SIZE * 0.25, cy + g.y * HEX_SIZE - g.s * HEX_SIZE * 0.25, g.s * HEX_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 230, 100, 0.4)';
      ctx.fill();
    }
  }

  drawStorageBar(ctx, cx, cy, pollenStored, POLLEN_STORAGE_CAPACITY, '#e0c020');
}

function drawProcessing(ctx: CanvasRenderingContext2D, cx: number, cy: number, nectarStored: number) {
  // Swirl/spiral indicating processing
  const r = HEX_SIZE * 0.3;
  const turns = 1.8;
  ctx.beginPath();
  ctx.strokeStyle = nectarStored > 0 ? '#90d060' : 'rgba(90, 140, 50, 0.7)';
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
  ctx.fillStyle = nectarStored > 0 ? '#a0e060' : 'rgba(90, 140, 50, 0.7)';
  ctx.fill();

  // Small arrow tips at spiral end to suggest motion
  const endAngle = turns * Math.PI * 2 - Math.PI / 2;
  const endX = cx + Math.cos(endAngle) * r;
  const endY = cy + Math.sin(endAngle) * r;
  ctx.beginPath();
  ctx.arc(endX, endY, HEX_SIZE * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = nectarStored > 0 ? '#90d060' : 'rgba(90, 140, 50, 0.7)';
  ctx.fill();

  drawStorageBar(ctx, cx, cy, nectarStored, NECTAR_STORAGE_CAPACITY, '#80d040');
}

function drawBroodCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, broodActive: boolean, broodProgress: number) {
  // Egg/larva shape
  const eggW = HEX_SIZE * 0.2;
  const eggH = HEX_SIZE * 0.32;

  ctx.beginPath();
  ctx.ellipse(cx, cy, eggW, eggH, 0, 0, Math.PI * 2);
  ctx.fillStyle = broodActive ? '#f5e8c8' : 'rgba(100, 90, 60, 0.6)';
  ctx.fill();
  ctx.strokeStyle = broodActive ? '#c0a060' : 'rgba(180, 150, 100, 0.7)';
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

function drawWaxWorks(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  // Honeycomb-like pattern with wax drop motif
  const r = HEX_SIZE * 0.12;
  const gap = r * 2;
  const offsets = [
    { q: -1, r: 0 }, { q: 1, r: 0 },
    { q: -0.5, r: -1 }, { q: 0.5, r: -1 },
    { q: -0.5, r: 1 }, { q: 0.5, r: 1 },
  ];
  const fillRatio = cell.honeyStored > 0 ? Math.min(cell.honeyStored / WAX_WORKS_HONEY_CAPACITY, 1) : 0;

  for (let i = 0; i < offsets.length; i++) {
    const ox = cx + offsets[i].q * gap;
    const oy = cy + offsets[i].r * gap * 0.87;
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
    ctx.fillStyle = filled ? '#d4a830' : 'rgba(70, 60, 25, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#8a7a40';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Wax drop at center
  const dropSize = HEX_SIZE * 0.12;
  ctx.beginPath();
  ctx.moveTo(cx, cy - dropSize * 1.5);
  ctx.quadraticCurveTo(cx + dropSize, cy, cx, cy + dropSize);
  ctx.quadraticCurveTo(cx - dropSize, cy, cx, cy - dropSize * 1.5);
  ctx.closePath();
  ctx.fillStyle = '#e8d8a0';
  ctx.fill();

  drawStorageBar(ctx, cx, cy, cell.honeyStored, WAX_WORKS_HONEY_CAPACITY, '#d4a830');
}

function drawNectarStorage(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: HexCell) {
  const fillRatio = Math.min(cell.nectarStored / NECTAR_CELL_CAPACITY, 1);

  // Draw droplets in a cluster pattern to represent nectar
  const droplets = [
    { x: 0, y: -0.18 },
    { x: -0.16, y: 0.05 },
    { x: 0.16, y: 0.05 },
    { x: 0, y: 0.18 },
    { x: -0.08, y: -0.06 },
  ];
  const dropSize = HEX_SIZE * 0.12;

  for (let i = 0; i < droplets.length; i++) {
    const d = droplets[i];
    const dx = cx + d.x * HEX_SIZE;
    const dy = cy + d.y * HEX_SIZE;
    const filled = i / droplets.length < fillRatio;

    // Droplet shape (teardrop)
    ctx.beginPath();
    ctx.moveTo(dx, dy - dropSize * 1.3);
    ctx.quadraticCurveTo(dx + dropSize, dy, dx, dy + dropSize * 0.6);
    ctx.quadraticCurveTo(dx - dropSize, dy, dx, dy - dropSize * 1.3);
    ctx.closePath();
    ctx.fillStyle = filled ? '#a0d850' : 'rgba(50, 80, 25, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#80c040';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (filled) {
      // Highlight
      ctx.beginPath();
      ctx.arc(dx - dropSize * 0.2, dy - dropSize * 0.3, dropSize * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180, 230, 100, 0.4)';
      ctx.fill();
    }
  }

  drawStorageBar(ctx, cx, cy, cell.nectarStored, NECTAR_CELL_CAPACITY, '#80d040');
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
