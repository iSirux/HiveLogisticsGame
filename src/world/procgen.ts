import { World } from './world';
import { TerrainType, FlowerType, Biome } from '../types';
import { hexDistance, hexToPixel, hexRing, hexNeighbors } from '../hex/hex';
import {
  CHUNK_SIZE,
  BIOME_MEADOW_RADIUS,
  HEX_SIZE,
  FLOWER_TYPE_CONFIG,
} from '../constants';

// Scale for biome noise sampling — larger = bigger biome patches
// Scale for biome noise sampling — larger = bigger biome patches
const BIOME_SCALE = 20;

// --- Seeded PRNG (mulberry32) ---

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// --- Deterministic hash for terrain noise ---

/** Hash two integers into a 0-1 value deterministically */
export function hashCoord(q: number, r: number, seed: number): number {
  // Simple integer hash combining q, r, seed
  let h = seed | 0;
  h = (Math.imul(h ^ (q * 374761393), 1103515245) + 12345) | 0;
  h = (Math.imul(h ^ (r * 668265263), 1103515245) + 12345) | 0;
  h = (h ^ (h >>> 15)) | 0;
  h = Math.imul(h, 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 3266489917) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0) / 4294967296;
}

/** Second independent hash channel */
function hashCoord2(q: number, r: number, seed: number): number {
  return hashCoord(q, r, seed ^ 0x9E3779B9);
}

// --- Chunk coordinate helpers ---

export function getChunkCoord(q: number, r: number): { cq: number; cr: number } {
  return {
    cq: Math.floor(q / CHUNK_SIZE),
    cr: Math.floor(r / CHUNK_SIZE),
  };
}

export function chunkKey(cq: number, cr: number): string {
  return `${cq},${cr}`;
}

// --- Biome determination ---

// Biome noise seed offsets for independent channels
const BIOME_SEED_A = 0x7A2F1E;
const BIOME_SEED_B = 0x3C8D5A;

export function getBiome(q: number, r: number, seed: number): Biome {
  const dist = hexDistance(0, 0, q, r);

  // Starting area is meadow with a noisy border (±3 hex jitter at coarse scale)
  const edgeNoise = hashCoord(Math.floor(q / 4), Math.floor(r / 4), seed ^ 0xED6E);
  const noisyRadius = BIOME_MEADOW_RADIUS - 3 + edgeNoise * 6; // range: radius-3 to radius+3
  if (dist <= noisyRadius) return 'meadow';

  // Multi-octave noise to avoid rectangular grid artifacts.
  // Octave 1: large scale, offset diagonally to break axis alignment
  const bq1 = Math.floor((q + r * 0.5) / BIOME_SCALE);
  const br1 = Math.floor((r + q * 0.3) / BIOME_SCALE);
  const n1 = hashCoord(bq1, br1, seed ^ BIOME_SEED_A);

  // Octave 2: medium scale, different axis rotation
  const s2 = BIOME_SCALE * 0.6;
  const bq2 = Math.floor((q - r * 0.3) / s2);
  const br2 = Math.floor((r - q * 0.2) / s2);
  const n2 = hashCoord(bq2, br2, seed ^ BIOME_SEED_B);

  // Octave 3: fine edge detail
  const s3 = BIOME_SCALE * 0.3;
  const bq3 = Math.floor((q + r * 0.4) / s3);
  const br3 = Math.floor((r - q * 0.4) / s3);
  const n3 = hashCoord(bq3, br3, seed ^ 0xBBCC);

  // Blend: heavy on large octave, medium adds shape, fine softens edges
  const blended = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

  // Variety channel (independent large-scale noise for threshold shifts)
  const nVar = hashCoord(bq1, br1, seed ^ 0x4D5E);

  if (blended < 0.3 + nVar * 0.08) return 'meadow';
  if (blended < 0.58 + nVar * 0.08) return 'forest';
  if (blended < 0.78) return 'wetland';
  return 'wilds';
}

// --- Flower type selection ---

export function pickFlowerType(biome: Biome, seed: number, cgq: number, cgr: number): FlowerType {
  const roll = hashCoord(cgq, cgr, seed ^ 0x7890);
  switch (biome) {
    case 'meadow':
      if (roll < 0.50) return FlowerType.Clover;
      if (roll < 0.80) return FlowerType.Wildflower;
      return FlowerType.Sunflower;
    case 'forest':
      if (roll < 0.70) return FlowerType.Bluebell;
      return FlowerType.Wildflower;
    default: // wetland, wilds
      if (roll < 0.60) return FlowerType.Clover;
      return FlowerType.Wildflower;
  }
}

// --- Flower cluster logic ---
// Clusters are placed on a coarse grid. Each coarse cell either has a cluster
// or doesn't (low probability). Flowers grow as connected blobs from the
// cluster center — every flower is hex-adjacent to at least one other flower.

export const FLOWER_GRID = 6; // coarse grid spacing for cluster centers

/** Deterministically grow a connected cluster of `size` hexes from a center.
 *  Growth is seeded: at each step, all frontier hexes (neighbors of the cluster
 *  not yet in it) are ranked by hash, and the lowest-hash one is added.
 *  excludeOriginRadius: hexes within this distance of (0,0) are skipped. */
export function growClusterShape(
  centerQ: number, centerR: number, size: number, seed: number, excludeOriginRadius = 0,
): Set<string> {
  const shape = new Set<string>();
  const key = (q: number, r: number) => `${q},${r}`;

  // If center is in exclusion zone, shift to nearest valid neighbor
  let startQ = centerQ;
  let startR = centerR;
  if (excludeOriginRadius > 0 && hexDistance(0, 0, centerQ, centerR) <= excludeOriginRadius) {
    // Walk outward until we find a valid start position
    let found = false;
    for (let ring = 1; ring <= excludeOriginRadius + 2 && !found; ring++) {
      let bestHash = Infinity;
      for (const h of hexRing(centerQ, centerR, ring)) {
        if (hexDistance(0, 0, h.q, h.r) <= excludeOriginRadius) continue;
        const hv = hashCoord(h.q, h.r, seed ^ 0xABCD);
        if (hv < bestHash) {
          bestHash = hv;
          startQ = h.q;
          startR = h.r;
          found = true;
        }
      }
    }
    if (!found) return shape;
  }

  shape.add(key(startQ, startR));

  for (let i = 1; i < size; i++) {
    // Find all frontier hexes: neighbors of shape members not already in shape
    let bestQ = 0, bestR = 0;
    let bestHash = Infinity;

    for (const k of shape) {
      const [mq, mr] = k.split(',').map(Number);
      for (const n of hexNeighbors(mq, mr)) {
        if (shape.has(key(n.q, n.r))) continue;
        if (excludeOriginRadius > 0 && hexDistance(0, 0, n.q, n.r) <= excludeOriginRadius) continue;
        const hv = hashCoord(n.q, n.r, seed ^ 0xF1F2);
        if (hv < bestHash) {
          bestHash = hv;
          bestQ = n.q;
          bestR = n.r;
        }
      }
    }

    if (bestHash === Infinity) break; // no more frontier (shouldn't happen in open space)
    shape.add(key(bestQ, bestR));
  }

  return shape;
}

/** Check if (q, r) is near a flower cluster center and should be a flower.
 *  excludeOriginRadius: positions within this hex distance of (0,0) are excluded. */
export function getFlowerCluster(q: number, r: number, seed: number, chance: number, biome: Biome, excludeOriginRadius = 0): { isFlower: boolean; flowerType: FlowerType } {
  const gq = Math.floor(q / FLOWER_GRID);
  const gr = Math.floor(r / FLOWER_GRID);

  for (let dq = -1; dq <= 1; dq++) {
    for (let dr = -1; dr <= 1; dr++) {
      const cgq = gq + dq;
      const cgr = gr + dr;

      // Does this coarse cell have a cluster?
      const clusterRoll = hashCoord(cgq, cgr, seed ^ 0xF10E);
      if (clusterRoll >= chance) continue;

      // Cluster center position: offset within the coarse cell
      const offsetQ = hashCoord(cgq, cgr, seed ^ 0xA1B2);
      const offsetR = hashCoord(cgq, cgr, seed ^ 0xC3D4);
      const centerQ = cgq * FLOWER_GRID + Math.floor(offsetQ * FLOWER_GRID);
      const centerR = cgr * FLOWER_GRID + Math.floor(offsetR * FLOWER_GRID);

      // Quick distance check: cluster can't extend beyond size hexes from center
      const dist = hexDistance(q, r, centerQ, centerR);
      if (dist > 8) continue; // generous upper bound for cluster reach

      // Determine flower type and cluster size
      const ft = pickFlowerType(biome, seed, cgq, cgr);
      const cfg = FLOWER_TYPE_CONFIG[ft];
      const countNoise = hashCoord(cgq, cgr, seed ^ 0xE5F6);
      const clusterSize = cfg.clusterMin + Math.floor(countNoise * (cfg.clusterMax - cfg.clusterMin + 1));

      // Grow connected cluster shape and check membership
      const shape = growClusterShape(centerQ, centerR, clusterSize, seed ^ (cgq * 7919 + cgr * 6271), excludeOriginRadius);
      if (shape.has(`${q},${r}`)) {
        return { isFlower: true, flowerType: ft };
      }
    }
  }

  return { isFlower: false, flowerType: FlowerType.Clover };
}

// --- Tree cluster logic ---

const TREE_GRID = 5;

function isTreeCluster(q: number, r: number, seed: number, chance: number, density: number): boolean {
  const gq = Math.floor(q / TREE_GRID);
  const gr = Math.floor(r / TREE_GRID);

  for (let dq = -1; dq <= 1; dq++) {
    for (let dr = -1; dr <= 1; dr++) {
      const cgq = gq + dq;
      const cgr = gr + dr;

      const clusterRoll = hashCoord(cgq, cgr, seed ^ 0x1234);
      if (clusterRoll >= chance) continue;

      const offsetQ = hashCoord(cgq, cgr, seed ^ 0x5678);
      const offsetR = hashCoord(cgq, cgr, seed ^ 0x9ABC);
      const centerQ = cgq * TREE_GRID + Math.floor(offsetQ * TREE_GRID);
      const centerR = cgr * TREE_GRID + Math.floor(offsetR * TREE_GRID);

      const dist = hexDistance(q, r, centerQ, centerR);
      if (dist > 1) continue;

      const hexRoll = hashCoord(q, r, seed ^ 0xDEF0);
      if (hexRoll < density) return true;
    }
  }
  return false;
}

// --- Terrain generation for a single hex ---

export function generateHexTerrain(q: number, r: number, seed: number): { terrain: TerrainType; props: Partial<HexProps>; biome: Biome } {
  const biome = getBiome(q, r, seed);
  const noise2 = hashCoord2(q, r, seed);

  // Don't overwrite hive area (radius 1 from origin)
  const distFromOrigin = hexDistance(0, 0, q, r);
  if (distFromOrigin <= 1) {
    return { terrain: TerrainType.Grass, props: {}, biome };
  }

  // Starting area (radius ≤ 6): no random flowers — a fixed cluster is placed by worldGen
  if (distFromOrigin <= 6) {
    return { terrain: TerrainType.Grass, props: {}, biome };
  }

  switch (biome) {
    case 'meadow': {
      // Flower clusters: ~20% of coarse cells have a cluster
      const fc = getFlowerCluster(q, r, seed, 0.20, biome, 6);
      if (fc.isFlower) return { ...makeFlower(q, r, seed, noise2, fc.flowerType), biome };
      return { terrain: TerrainType.Grass, props: {}, biome };
    }
    case 'forest': {
      // Tree clusters: ~12% of coarse cells, ~70% fill within cluster
      if (isTreeCluster(q, r, seed, 0.12, 0.7)) {
        return {
          terrain: TerrainType.Tree,
          props: {
            resinMax: 0.5 + noise2 * 0.5,
            resinAmount: 0.5 + noise2 * 0.5,
          },
          biome,
        };
      }
      // Honeysuckle: rare singles right at the forest edge (within 3 hexes of meadow border)
      if (q % 2 === 0 && r % 2 === 0 && distFromOrigin > BIOME_MEADOW_RADIUS && distFromOrigin <= BIOME_MEADOW_RADIUS + 3) {
        const honeysuckleRoll = hashCoord(q, r, seed ^ 0xBEE5);
        if (honeysuckleRoll < 0.012) {
          return { ...makeFlower(q, r, seed, noise2, FlowerType.Honeysuckle), biome };
        }
      }
      // Flower clusters in forest: ~8% of coarse cells
      const fc = getFlowerCluster(q, r, seed ^ 0x5678, 0.08, biome, 6);
      if (fc.isFlower) return { ...makeFlower(q, r, seed, noise2, fc.flowerType), biome };
      return { terrain: TerrainType.Grass, props: {}, biome };
    }
    case 'wetland': {
      // Water ponds: sparse coarse grid, larger clusters
      const WATER_GRID = 8;
      const wgq = Math.floor(q / WATER_GRID);
      const wgr = Math.floor(r / WATER_GRID);
      const waterRoll = hashCoord(wgq, wgr, seed ^ 0x9ABC);
      if (waterRoll < 0.10) {
        const wOffQ = hashCoord(wgq, wgr, seed ^ 0xAAAA);
        const wOffR = hashCoord(wgq, wgr, seed ^ 0xBBBB);
        const wcQ = wgq * WATER_GRID + Math.floor(wOffQ * WATER_GRID);
        const wcR = wgr * WATER_GRID + Math.floor(wOffR * WATER_GRID);
        const wDist = hexDistance(q, r, wcQ, wcR);
        // Radius 3 ponds with noisy fill for organic shape
        const fillNoise = hashCoord(q, r, seed ^ 0xCCDD);
        if (wDist <= 1 || (wDist <= 2 && fillNoise < 0.7) || (wDist <= 3 && fillNoise < 0.3)) {
          return { terrain: TerrainType.Water, props: {}, biome };
        }
      }
      // Sparse flower clusters: ~5%
      const fc = getFlowerCluster(q, r, seed ^ 0xCDEF, 0.05, biome, 6);
      if (fc.isFlower) return { ...makeFlower(q, r, seed, noise2, fc.flowerType), biome };
      return { terrain: TerrainType.Grass, props: {}, biome };
    }
    case 'wilds': {
      // Sparse tree clusters: ~6%, ~50% fill
      if (isTreeCluster(q, r, seed ^ 0x4321, 0.06, 0.5)) {
        return {
          terrain: TerrainType.Tree,
          props: {
            resinMax: 0.3 + noise2 * 0.7,
            resinAmount: 0.3 + noise2 * 0.7,
          },
          biome,
        };
      }
      // Very sparse flower clusters: ~3%
      const fc = getFlowerCluster(q, r, seed ^ 0x8765, 0.03, biome, 6);
      if (fc.isFlower) return { ...makeFlower(q, r, seed, noise2, fc.flowerType), biome };
      // Rare small ponds in wilds
      const WILDS_WATER_GRID = 12;
      const wwgq = Math.floor(q / WILDS_WATER_GRID);
      const wwgr = Math.floor(r / WILDS_WATER_GRID);
      const wildsWaterRoll = hashCoord(wwgq, wwgr, seed ^ 0xD1D2);
      if (wildsWaterRoll < 0.06) {
        const wwOffQ = hashCoord(wwgq, wwgr, seed ^ 0xD3D4);
        const wwOffR = hashCoord(wwgq, wwgr, seed ^ 0xD5D6);
        const wwcQ = wwgq * WILDS_WATER_GRID + Math.floor(wwOffQ * WILDS_WATER_GRID);
        const wwcR = wwgr * WILDS_WATER_GRID + Math.floor(wwOffR * WILDS_WATER_GRID);
        const wwDist = hexDistance(q, r, wwcQ, wwcR);
        if (wwDist <= 1) {
          return { terrain: TerrainType.Water, props: {}, biome };
        }
      }
      return { terrain: TerrainType.Grass, props: {}, biome };
    }
  }
}

export interface HexProps {
  nectarAmount: number;
  nectarMax: number;
  pollenAmount: number;
  pollenMax: number;
  flowerColor: string;
  flowerType: FlowerType;
  resinAmount: number;
  resinMax: number;
}

function makeFlower(q: number, r: number, seed: number, noise2: number, ft: FlowerType): { terrain: TerrainType; props: Partial<HexProps> } {
  const cfg = FLOWER_TYPE_CONFIG[ft];
  const nectarMax = cfg.nectarMin + noise2 * (cfg.nectarMax - cfg.nectarMin);
  const pollenNoise = hashCoord(q, r, seed ^ 0x4321);
  const pollenMax = cfg.pollenMin + pollenNoise * (cfg.pollenMax - cfg.pollenMin);
  return {
    terrain: TerrainType.Flower,
    props: {
      nectarAmount: nectarMax,
      nectarMax,
      pollenAmount: pollenMax,
      pollenMax,
      flowerColor: cfg.color,
      flowerType: ft,
    },
  };
}

// --- Chunk generation ---

export function generateChunk(world: World, cq: number, cr: number): void {
  const key = chunkKey(cq, cr);
  if (world.loadedChunks.has(key)) return;

  world.loadedChunks.add(key);

  const startQ = cq * CHUNK_SIZE;
  const startR = cr * CHUNK_SIZE;

  for (let dq = 0; dq < CHUNK_SIZE; dq++) {
    for (let dr = 0; dr < CHUNK_SIZE; dr++) {
      const q = startQ + dq;
      const r = startR + dr;

      // Don't overwrite existing cells (e.g. hive)
      if (world.grid.has(q, r)) continue;

      const { terrain, props, biome } = generateHexTerrain(q, r, world.worldSeed);
      const cell = world.grid.createCell(q, r, terrain);
      cell.biome = biome;

      // Apply generated properties
      if (props.nectarAmount !== undefined) cell.nectarAmount = props.nectarAmount;
      if (props.nectarMax !== undefined) cell.nectarMax = props.nectarMax;
      if (props.pollenAmount !== undefined) cell.pollenAmount = props.pollenAmount;
      if (props.pollenMax !== undefined) cell.pollenMax = props.pollenMax;
      if (props.flowerColor !== undefined) cell.flowerColor = props.flowerColor;
      if (props.flowerType !== undefined) cell.flowerType = props.flowerType;
      if (props.resinAmount !== undefined) cell.resinAmount = props.resinAmount;
      if (props.resinMax !== undefined) cell.resinMax = props.resinMax;
    }
  }

  // Update world bounds
  updateWorldBounds(world);
  world.terrainVersion++;
}

// --- Ensure chunks around a point ---

export function ensureChunksAroundPoint(world: World, q: number, r: number, chunkRadius: number): void {
  const center = getChunkCoord(q, r);
  for (let dcq = -chunkRadius; dcq <= chunkRadius; dcq++) {
    for (let dcr = -chunkRadius; dcr <= chunkRadius; dcr++) {
      generateChunk(world, center.cq + dcq, center.cr + dcr);
    }
  }
}

// --- World bounds tracking ---

export function updateWorldBounds(world: World): void {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  // Only consider explored cells for camera bounds
  for (const cell of world.grid.cells.values()) {
    if (!cell.explored) continue;
    const { x, y } = hexToPixel(cell.q, cell.r);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (minX === Infinity) {
    // No explored cells, default to origin area
    world.worldBoundsMinX = -HEX_SIZE * 10;
    world.worldBoundsMaxX = HEX_SIZE * 10;
    world.worldBoundsMinY = -HEX_SIZE * 10;
    world.worldBoundsMaxY = HEX_SIZE * 10;
  } else {
    const margin = HEX_SIZE * 6;
    world.worldBoundsMinX = minX - margin;
    world.worldBoundsMaxX = maxX + margin;
    world.worldBoundsMinY = minY - margin;
    world.worldBoundsMaxY = maxY + margin;
  }
}
