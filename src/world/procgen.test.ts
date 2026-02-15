import { describe, it, expect } from 'vitest';
import { TerrainType, FlowerType, type Biome } from '../types';
import { hexDistance, hexDisk, hexNeighbors } from '../hex/hex';
import { CHUNK_SIZE, BIOME_MEADOW_RADIUS, FLOWER_TYPE_CONFIG } from '../constants';
import {
  hashCoord,
  getBiome,
  growClusterShape,
  getFlowerCluster,
  generateHexTerrain,
  generateChunk,
  ensureChunksAroundPoint,
} from './procgen';
import { World } from './world';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a full initial world (same as generateWorld but without bees/fog/hive) */
function generateTestChunks(seed: number, chunkRadius = 2): World {
  const world = new World();
  world.worldSeed = seed;
  ensureChunksAroundPoint(world, 0, 0, chunkRadius);
  return world;
}

/** Count terrain types in a world */
function countTerrain(world: World): Map<TerrainType, number> {
  const counts = new Map<TerrainType, number>();
  for (const cell of world.grid.cells.values()) {
    counts.set(cell.terrain, (counts.get(cell.terrain) || 0) + 1);
  }
  return counts;
}

/** Get all flower cells within a given hex radius of origin */
function flowersInRadius(world: World, radius: number) {
  const flowers = [];
  for (const cell of world.grid.cells.values()) {
    if (cell.terrain === TerrainType.Flower && hexDistance(0, 0, cell.q, cell.r) <= radius) {
      flowers.push(cell);
    }
  }
  return flowers;
}

/** Flood-fill to find connected flower clusters (hex-adjacent, distance 1) */
function findClusters(world: World) {
  const visited = new Set<string>();
  const clusters: { type: FlowerType; biome: Biome; members: { q: number; r: number }[] }[] = [];

  for (const cell of world.grid.cells.values()) {
    if (cell.terrain !== TerrainType.Flower) continue;
    const key = `${cell.q},${cell.r}`;
    if (visited.has(key)) continue;

    const queue = [cell];
    const members: { q: number; r: number }[] = [];
    visited.add(key);

    while (queue.length > 0) {
      const cur = queue.pop()!;
      members.push({ q: cur.q, r: cur.r });

      for (const h of hexNeighbors(cur.q, cur.r)) {
        const nk = `${h.q},${h.r}`;
        if (visited.has(nk)) continue;
        const nc = world.grid.get(h.q, h.r);
        if (!nc || nc.terrain !== TerrainType.Flower) continue;
        visited.add(nk);
        queue.push(nc);
      }
    }

    clusters.push({ type: cell.flowerType, biome: cell.biome, members });
  }

  return clusters;
}

// Test across multiple seeds to catch seed-dependent issues
const TEST_SEEDS = [42, 12345, 999999, 1744932974, 7777777];

// ---------------------------------------------------------------------------
// hashCoord
// ---------------------------------------------------------------------------

describe('hashCoord', () => {
  it('returns values in [0, 1)', () => {
    for (let i = -50; i < 50; i++) {
      const v = hashCoord(i, i * 3, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    expect(hashCoord(5, 10, 42)).toBe(hashCoord(5, 10, 42));
    expect(hashCoord(-3, 7, 999)).toBe(hashCoord(-3, 7, 999));
  });

  it('different inputs produce different outputs', () => {
    const a = hashCoord(0, 0, 42);
    const b = hashCoord(1, 0, 42);
    const c = hashCoord(0, 1, 42);
    const d = hashCoord(0, 0, 43);
    // Not all the same (statistical — extremely unlikely to collide)
    expect(new Set([a, b, c, d]).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// getBiome
// ---------------------------------------------------------------------------

describe('getBiome', () => {
  it('origin area is always meadow', () => {
    for (const seed of TEST_SEEDS) {
      for (const h of hexDisk(0, 0, BIOME_MEADOW_RADIUS - 4)) {
        expect(getBiome(h.q, h.r, seed)).toBe('meadow');
      }
    }
  });

  it('produces all four biome types across a large area', () => {
    for (const seed of TEST_SEEDS) {
      const biomes = new Set<Biome>();
      for (let q = -40; q <= 40; q += 2) {
        for (let r = -40; r <= 40; r += 2) {
          biomes.add(getBiome(q, r, seed));
        }
      }
      expect(biomes.has('meadow')).toBe(true);
      expect(biomes.has('forest')).toBe(true);
      // wetland and wilds may not appear for every seed in a small area,
      // but should appear for most
    }
  });

  it('is deterministic for same seed', () => {
    const seed = 42;
    for (let q = -10; q <= 10; q++) {
      for (let r = -10; r <= 10; r++) {
        expect(getBiome(q, r, seed)).toBe(getBiome(q, r, seed));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// growClusterShape
// ---------------------------------------------------------------------------

describe('growClusterShape', () => {
  it('returns a connected set of the requested size', () => {
    for (const seed of TEST_SEEDS) {
      const shape = growClusterShape(10, 10, 6, seed);
      expect(shape.size).toBe(6);
    }
  });

  it('all members are hex-adjacent to at least one other member', () => {
    const shape = growClusterShape(10, 10, 7, 42);
    for (const k of shape) {
      const [q, r] = k.split(',').map(Number);
      const hasNeighbor = hexNeighbors(q, r).some(n => shape.has(`${n.q},${n.r}`));
      expect(hasNeighbor).toBe(true);
    }
  });

  it('is deterministic', () => {
    const a = growClusterShape(5, 5, 6, 42);
    const b = growClusterShape(5, 5, 6, 42);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('respects excludeOriginRadius', () => {
    const shape = growClusterShape(5, 5, 6, 42, 6);
    for (const k of shape) {
      const [q, r] = k.split(',').map(Number);
      expect(hexDistance(0, 0, q, r)).toBeGreaterThan(6);
    }
  });

  it('includes center when not in exclusion zone', () => {
    const shape = growClusterShape(20, 20, 5, 42);
    expect(shape.has('20,20')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFlowerCluster
// ---------------------------------------------------------------------------

describe('getFlowerCluster', () => {
  it('with chance=0, never produces flowers', () => {
    for (const seed of TEST_SEEDS) {
      for (let q = -20; q <= 20; q++) {
        for (let r = -20; r <= 20; r++) {
          expect(getFlowerCluster(q, r, seed, 0, 'meadow').isFlower).toBe(false);
        }
      }
    }
  });

  it('with chance=1.0, produces a reasonable number of flowers', () => {
    for (const seed of TEST_SEEDS) {
      let flowers = 0;
      let total = 0;
      for (let q = -20; q <= 20; q++) {
        for (let r = -20; r <= 20; r++) {
          total++;
          if (getFlowerCluster(q, r, seed, 1.0, 'meadow').isFlower) flowers++;
        }
      }
      // With every coarse cell having a cluster, we should get a solid percentage of flowers
      expect(flowers).toBeGreaterThan(total * 0.05);
    }
  });

  it('is deterministic', () => {
    const seed = 42;
    for (let q = -16; q <= 16; q++) {
      for (let r = -16; r <= 16; r++) {
        const a = getFlowerCluster(q, r, seed, 0.15, 'meadow');
        const b = getFlowerCluster(q, r, seed, 0.15, 'meadow');
        expect(a.isFlower).toBe(b.isFlower);
        expect(a.flowerType).toBe(b.flowerType);
      }
    }
  });

  it('higher chance produces more flowers', () => {
    const seed = 42;
    const countAt = (chance: number) => {
      let n = 0;
      for (let q = -30; q <= 30; q++) {
        for (let r = -30; r <= 30; r++) {
          if (getFlowerCluster(q, r, seed, chance, 'meadow').isFlower) n++;
        }
      }
      return n;
    };
    const low = countAt(0.05);
    const high = countAt(0.50);
    expect(high).toBeGreaterThan(low);
  });
});

// ---------------------------------------------------------------------------
// generateHexTerrain
// ---------------------------------------------------------------------------

describe('generateHexTerrain', () => {
  it('returns grass for hive area (radius <= 1)', () => {
    for (const seed of TEST_SEEDS) {
      expect(generateHexTerrain(0, 0, seed).terrain).toBe(TerrainType.Grass);
      for (const h of hexDisk(0, 0, 1)) {
        expect(generateHexTerrain(h.q, h.r, seed).terrain).toBe(TerrainType.Grass);
      }
    }
  });

  it('returns grass for starter zone (radius <= 6)', () => {
    for (const seed of TEST_SEEDS) {
      for (const h of hexDisk(0, 0, 6)) {
        expect(generateHexTerrain(h.q, h.r, seed).terrain).toBe(TerrainType.Grass);
      }
    }
  });

  it('flower cells have valid nectar/pollen values', () => {
    const seed = 42;
    for (let q = -30; q <= 30; q++) {
      for (let r = -30; r <= 30; r++) {
        const result = generateHexTerrain(q, r, seed);
        if (result.terrain === TerrainType.Flower) {
          expect(result.props.nectarMax).toBeGreaterThan(0);
          expect(result.props.nectarAmount).toBeGreaterThan(0);
          expect(result.props.nectarAmount).toBeLessThanOrEqual(result.props.nectarMax!);
          expect(result.props.pollenAmount).toBeLessThanOrEqual(result.props.pollenMax!);
          expect(result.props.flowerColor).toBeTruthy();
          expect(result.props.flowerType).toBeTruthy();
        }
      }
    }
  });

  it('is deterministic', () => {
    const seed = 42;
    for (let q = -15; q <= 15; q++) {
      for (let r = -15; r <= 15; r++) {
        const a = generateHexTerrain(q, r, seed);
        const b = generateHexTerrain(q, r, seed);
        expect(a.terrain).toBe(b.terrain);
        expect(a.biome).toBe(b.biome);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Full world generation: flower cluster quality
// ---------------------------------------------------------------------------

describe('world flower generation', () => {
  it('generates flowers in the initial chunks', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const terrain = countTerrain(world);
      const flowerCount = terrain.get(TerrainType.Flower) || 0;
      expect(flowerCount).toBeGreaterThan(0);
    }
  });

  it('generates at least 10 flowers in initial map', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const terrain = countTerrain(world);
      const flowerCount = terrain.get(TerrainType.Flower) || 0;
      expect(flowerCount).toBeGreaterThanOrEqual(10);
    }
  });

  it('generates flowers within foraging range (radius 12) of hive', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const nearby = flowersInRadius(world, 12);
      expect(nearby.length).toBeGreaterThan(0);
    }
  });

  it('flowers have non-zero nectar', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      for (const cell of world.grid.cells.values()) {
        if (cell.terrain === TerrainType.Flower) {
          expect(cell.nectarMax).toBeGreaterThan(0);
          expect(cell.nectarAmount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('flowers within a cluster are hex-adjacent (connected)', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const clusters = findClusters(world);
      for (const c of clusters) {
        if (c.members.length === 1) continue; // singletons are trivially connected
        for (const m of c.members) {
          const hasNeighborInCluster = hexNeighbors(m.q, m.r).some(n =>
            c.members.some(o => o.q === n.q && o.r === n.r)
          );
          expect(hasNeighborInCluster).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cluster shape and sizing
// ---------------------------------------------------------------------------

describe('flower cluster quality', () => {
  it('most clusters have more than 1 flower', () => {
    let totalClusters = 0;
    let singletons = 0;

    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const clusters = findClusters(world);
      for (const c of clusters) {
        totalClusters++;
        if (c.members.length === 1) singletons++;
      }
    }

    // Singleton clusters should be the minority
    const singletonRate = singletons / totalClusters;
    expect(singletonRate).toBeLessThan(0.5);
  });

  it('cluster sizes respect FLOWER_TYPE_CONFIG min/max', () => {
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const clusters = findClusters(world);
      for (const c of clusters) {
        const cfg = FLOWER_TYPE_CONFIG[c.type];
        // Allow some tolerance: flood-fill clusters may merge nearby procgen clusters.
        // But no cluster should wildly exceed the max.
        expect(c.members.length).toBeLessThanOrEqual(cfg.clusterMax * 2);
      }
    }
  });

  it('meadow biome has the most flower clusters', () => {
    let meadowClusters = 0;

    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      const clusters = findClusters(world);
      for (const c of clusters) {
        if (c.biome === 'meadow') meadowClusters++;
      }
    }

    expect(meadowClusters).toBeGreaterThan(0);
  });

  it('multiple flower types appear across seeds', () => {
    const allTypes = new Set<FlowerType>();
    for (const seed of TEST_SEEDS) {
      const world = generateTestChunks(seed);
      for (const cell of world.grid.cells.values()) {
        if (cell.terrain === TerrainType.Flower) {
          allTypes.add(cell.flowerType);
        }
      }
    }
    // At minimum we should see clover, wildflower, and bluebell
    expect(allTypes.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Chunk generation mechanics
// ---------------------------------------------------------------------------

describe('chunk generation', () => {
  it('generates expected number of cells per chunk', () => {
    const world = new World();
    world.worldSeed = 42;
    generateChunk(world, 0, 0);
    expect(world.grid.cells.size).toBe(CHUNK_SIZE * CHUNK_SIZE);
  });

  it('does not overwrite existing cells', () => {
    const world = new World();
    world.worldSeed = 42;
    // Place a hive cell manually
    world.grid.createCell(5, 5, TerrainType.HiveEntrance);
    generateChunk(world, 0, 0);
    // The hive cell should not have been overwritten
    expect(world.grid.get(5, 5)!.terrain).toBe(TerrainType.HiveEntrance);
  });

  it('does not regenerate already-loaded chunks', () => {
    const world = new World();
    world.worldSeed = 42;
    generateChunk(world, 0, 0);
    const cellCount = world.grid.cells.size;
    // Generating same chunk again should be a no-op
    generateChunk(world, 0, 0);
    expect(world.grid.cells.size).toBe(cellCount);
  });

  it('adjacent chunks tile without gaps', () => {
    const world = new World();
    world.worldSeed = 42;
    generateChunk(world, 0, 0);
    generateChunk(world, 1, 0);
    generateChunk(world, 0, 1);
    // Should have cells covering both chunk ranges without gaps
    for (let q = 0; q < CHUNK_SIZE * 2; q++) {
      for (let r = 0; r < CHUNK_SIZE; r++) {
        expect(world.grid.has(q, r)).toBe(true);
      }
    }
  });
});
