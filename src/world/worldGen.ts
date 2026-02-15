import { World } from './world';
import { TerrainType, BeeRole, BeeState, BeeEntity, FlowerType, Biome, HexCell } from '../types';
import { hexToPixel, hexRing, hexDisk, hexNeighbors, hexDistance, hexKey } from '../hex/hex';
import {
  STARTING_FORAGERS, STARTING_NURSES, STARTING_BUILDERS, STARTING_SCOUTS, STARTING_HAULERS,
  BEE_MEAN_LIFESPAN, BEE_LIFESPAN_VARIANCE, FLOWER_TYPE_CONFIG,
} from '../constants';
import { ensureChunksAroundPoint, updateWorldBounds } from './procgen';

export function generateWorld(world: World): void {
  // Set seed for new world
  world.worldSeed = Math.floor(Math.random() * 0x7FFFFFFF);

  // Generate initial chunks around origin (radius 2 chunks = covers ~32 hex radius)
  ensureChunksAroundPoint(world, 0, 0, 2);

  // Place hive at origin
  placeHive(world);

  // Place fixed starter clover cluster near the hive
  placeStarterFlowers(world);

  // Initialize fog: only hive area (radius 6) is explored
  initFog(world);

  // Update world bounds after initial setup
  updateWorldBounds(world);

  // Spawn starting bees
  spawnStartingBees(world);

  // Log world generation summary
  logWorldGenSummary(world);
}

function placeHive(world: World): void {
  // Ensure cells exist at origin and ring-1
  const entrance = world.grid.get(0, 0);
  if (!entrance) return;
  entrance.terrain = TerrainType.HiveEntrance;

  // Ring-1: 2 honey storage, 1 pollen storage, 1 nectar storage, 1 processing, 1 brood
  const ring = hexRing(0, 0, 1);
  const assignments: TerrainType[] = [
    TerrainType.HoneyStorage,
    TerrainType.HoneyStorage,
    TerrainType.Processing,
    TerrainType.Brood,
    TerrainType.NectarStorage,
    TerrainType.PollenStorage,
  ];
  for (let i = 0; i < ring.length; i++) {
    const cell = world.grid.get(ring[i].q, ring[i].r);
    if (!cell) continue;
    cell.terrain = assignments[i];
    // Seed honey storage with starting honey
    if (assignments[i] === TerrainType.HoneyStorage) {
      cell.honeyStored = 3;
      world.resources.honey += 3;
    }
  }
}

function placeStarterFlowers(world: World): void {
  // Place a single clover cluster at a random position on ring 4 from hive
  const cfg = FLOWER_TYPE_CONFIG[FlowerType.Clover];
  const ring = hexRing(0, 0, 4);
  const pick = Math.floor(Math.random() * ring.length);
  const centerQ = ring[pick].q;
  const centerR = ring[pick].r;

  // Center flower + ring-1 neighbors = a nice cluster of ~5 flowers
  const clusterPositions = [
    { q: centerQ, r: centerR },
    ...hexNeighbors(centerQ, centerR).slice(0, 4), // 4 surrounding flowers
  ];

  for (const pos of clusterPositions) {
    const cell = world.grid.get(pos.q, pos.r);
    if (!cell) continue;
    // Don't overwrite hive cells
    if (cell.terrain !== TerrainType.Grass) continue;

    cell.terrain = TerrainType.Flower;
    cell.flowerType = FlowerType.Clover;
    cell.flowerColor = cfg.color;
    cell.nectarMax = (cfg.nectarMin + cfg.nectarMax) / 2;
    cell.nectarAmount = cell.nectarMax;
    cell.pollenMax = (cfg.pollenMin + cfg.pollenMax) / 2;
    cell.pollenAmount = cell.pollenMax;
  }
}

function initFog(world: World): void {
  // Reveal radius 6 so foragers can see nearby flower clusters
  for (const h of hexDisk(0, 0, 6)) {
    const cell = world.grid.get(h.q, h.r);
    if (cell) cell.explored = true;
  }
}

interface FlowerCluster {
  flowers: HexCell[];
  type: FlowerType;
  biome: Biome;
  centerQ: number;
  centerR: number;
  totalNectar: number;
  totalPollen: number;
  distFromHive: number;
}

/** Flood-fill to find connected flower clusters (hex-adjacent) */
function findFlowerClusters(world: World): FlowerCluster[] {
  const visited = new Set<string>();
  const clusters: FlowerCluster[] = [];

  for (const cell of world.grid.cells.values()) {
    if (cell.terrain !== TerrainType.Flower) continue;
    const key = hexKey(cell.q, cell.r);
    if (visited.has(key)) continue;

    // BFS flood-fill: hex-adjacent flowers belong to the same cluster
    const queue: HexCell[] = [cell];
    const members: HexCell[] = [];
    visited.add(key);

    while (queue.length > 0) {
      const cur = queue.pop()!;
      members.push(cur);

      for (const h of hexNeighbors(cur.q, cur.r)) {
        const nk = hexKey(h.q, h.r);
        if (visited.has(nk)) continue;
        const nc = world.grid.get(h.q, h.r);
        if (!nc || nc.terrain !== TerrainType.Flower) continue;
        visited.add(nk);
        queue.push(nc);
      }
    }

    // Compute cluster center (average position)
    let sumQ = 0, sumR = 0, totalNectar = 0, totalPollen = 0;
    for (const m of members) {
      sumQ += m.q;
      sumR += m.r;
      totalNectar += m.nectarAmount;
      totalPollen += m.pollenAmount;
    }
    const centerQ = Math.round(sumQ / members.length);
    const centerR = Math.round(sumR / members.length);

    clusters.push({
      flowers: members,
      type: members[0].flowerType,
      biome: members[0].biome,
      centerQ,
      centerR,
      totalNectar,
      totalPollen,
      distFromHive: hexDistance(0, 0, centerQ, centerR),
    });
  }

  return clusters;
}

function logWorldGenSummary(world: World): void {
  const biomeCounts: Record<Biome, number> = { meadow: 0, forest: 0, wetland: 0, wilds: 0 };
  const terrainCounts: Partial<Record<TerrainType, number>> = {};
  let totalCells = 0;

  for (const cell of world.grid.cells.values()) {
    totalCells++;
    biomeCounts[cell.biome] = (biomeCounts[cell.biome] || 0) + 1;
    terrainCounts[cell.terrain] = (terrainCounts[cell.terrain] || 0) + 1;
  }

  const flowerCount = terrainCounts[TerrainType.Flower] || 0;

  console.group('[WorldGen] Generation Summary');
  console.log(`Seed: ${world.worldSeed}`);
  console.log(`Total cells: ${totalCells} | Chunks: ${world.loadedChunks.size}`);

  // Biomes
  console.log('Biomes:', Object.entries(biomeCounts).map(([b, c]) => `${b}=${c} (${(c / totalCells * 100).toFixed(1)}%)`).join(', '));

  // Terrain
  console.log('Terrain:', Object.entries(terrainCounts).map(([t, c]) => `${t}=${c}`).join(', '));

  // --- Flower Cluster Analysis ---
  const clusters = findFlowerClusters(world);
  clusters.sort((a, b) => a.distFromHive - b.distFromHive);

  // Per-biome cluster stats
  const biomeClusterStats: Record<string, { count: number; flowers: number }> = {};
  // Per-type cluster stats
  const typeClusterStats: Record<string, { count: number; flowers: number; nectar: number; pollen: number }> = {};

  for (const c of clusters) {
    const bs = biomeClusterStats[c.biome] ??= { count: 0, flowers: 0 };
    bs.count++;
    bs.flowers += c.flowers.length;

    const ts = typeClusterStats[c.type] ??= { count: 0, flowers: 0, nectar: 0, pollen: 0 };
    ts.count++;
    ts.flowers += c.flowers.length;
    ts.nectar += c.totalNectar;
    ts.pollen += c.totalPollen;
  }

  console.group(`Flower Clusters: ${clusters.length} clusters, ${flowerCount} flowers total`);

  // By biome
  console.log('By biome:', Object.entries(biomeClusterStats)
    .map(([b, s]) => `${b}: ${s.count} clusters (${s.flowers} flowers)`)
    .join(' | '));

  // By type
  console.log('By type:', Object.entries(typeClusterStats)
    .map(([t, s]) => `${t}: ${s.count} clusters, ${s.flowers} flowers, nectar=${s.nectar.toFixed(1)}, pollen=${s.pollen.toFixed(1)}`)
    .join(' | '));

  // Cluster size distribution
  const sizes = clusters.map(c => c.flowers.length);
  if (sizes.length > 0) {
    sizes.sort((a, b) => a - b);
    console.log(`Cluster sizes: min=${sizes[0]}, max=${sizes[sizes.length - 1]}, median=${sizes[Math.floor(sizes.length / 2)]}, avg=${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)}`);
  }

  // Individual clusters as a table
  const tableData = clusters.map(c => ({
    pos: `(${c.centerQ},${c.centerR})`,
    dist: c.distFromHive,
    biome: c.biome,
    type: c.type,
    size: c.flowers.length,
    nectar: +c.totalNectar.toFixed(2),
    pollen: +c.totalPollen.toFixed(2),
    flowers: c.flowers.map(f => `(${f.q},${f.r})`).join(' '),
  }));
  console.table(tableData);

  console.groupEnd();

  // Starter flowers (within revealed area)
  let starterFlowers = 0;
  for (const h of hexDisk(0, 0, 6)) {
    const cell = world.grid.get(h.q, h.r);
    if (cell && cell.terrain === TerrainType.Flower) starterFlowers++;
  }
  console.log(`Starter flowers (radius 6): ${starterFlowers}`);

  // Nearby reachable flowers (within radius 12 — meadow range)
  let meadowFlowers = 0;
  for (const cell of world.grid.cells.values()) {
    if (cell.terrain === TerrainType.Flower && hexDistance(0, 0, cell.q, cell.r) <= 12) {
      meadowFlowers++;
    }
  }
  console.log(`Meadow-range flowers (radius 12): ${meadowFlowers}`);

  console.log(`Starting bees: ${world.bees.length}`);
  console.groupEnd();
}

function spawnStartingBees(world: World): void {
  const roles: { role: BeeRole; count: number }[] = [
    { role: BeeRole.Forager, count: STARTING_FORAGERS },
    { role: BeeRole.Nurse, count: STARTING_NURSES },
    { role: BeeRole.Scout, count: STARTING_SCOUTS },
    { role: BeeRole.Hauler, count: STARTING_HAULERS },
    { role: BeeRole.Builder, count: STARTING_BUILDERS },
  ];

  for (const { role, count } of roles) {
    for (let i = 0; i < count; i++) {
      createBee(world, role, 0, 0, true);
    }
  }
}

export function createBee(world: World, role: BeeRole, q: number, r: number, randomAge = false): BeeEntity {
  const { x, y } = hexToPixel(q, r);
  const ox = (Math.random() - 0.5) * 10;
  const oy = (Math.random() - 0.5) * 10;
  const bee: BeeEntity = {
    id: world.nextEntityId++,
    role,
    state: BeeState.Idle,
    q, r,
    pixelX: x + ox,
    pixelY: y + oy,
    prevPixelX: x + ox,
    prevPixelY: y + oy,
    path: [],
    moveProgress: 0,
    carrying: { nectar: 0, pollen: 0 },
    targetQ: 0,
    targetR: 0,
    explorationTarget: null,
    danceTicks: 0,
    baseQ: 0,
    baseR: 0,
    stateTimer: 0,
    energy: 1.0,
    age: randomAge ? Math.floor(Math.random() * 1000) : 0,
    maxAge: BEE_MEAN_LIFESPAN + Math.floor((Math.random() - 0.5) * 2 * BEE_LIFESPAN_VARIANCE),
    wingPhase: Math.random() * Math.PI * 2,
  };
  world.bees.push(bee);
  return bee;
}
