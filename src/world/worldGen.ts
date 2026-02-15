import { World } from './world';
import { TerrainType, BeeRole, BeeState, BeeEntity } from '../types';
import { hexToPixel, hexRing, hexDisk, hexDistance } from '../hex/hex';
import {
  WORLD_RADIUS, FLOWER_CLUSTER_COUNT, FOREST_FLOWER_CLUSTER_COUNT, FLOWER_MIN_DISTANCE,
  INITIAL_NECTAR_MIN, INITIAL_NECTAR_MAX,
  INITIAL_POLLEN_MIN, INITIAL_POLLEN_MAX,
  STARTING_FORAGERS, STARTING_NURSES, STARTING_BUILDERS, STARTING_SCOUTS,
  BIOME_MEADOW_RADIUS, BIOME_FOREST_RADIUS,
  TREE_CLUSTER_COUNT, WATER_CLUSTER_COUNT,
} from '../constants';

const FLOWER_COLORS = ['#ff69b4', '#ff6090', '#e060e0', '#c070ff', '#ff8040', '#ff5050'];

export function generateWorld(world: World): void {
  // Fill grass hexes
  for (const h of hexDisk(0, 0, WORLD_RADIUS)) {
    world.grid.createCell(h.q, h.r, TerrainType.Grass);
  }

  // Place hive at origin
  placeHive(world);

  // Scatter flower clusters (mainly in meadow, some in forest)
  placeFlowers(world);

  // Place tree clusters in forest biome
  placeTrees(world);

  // Place water clusters in wetland biome
  placeWater(world);

  // Initialize fog: only hive area (radius 4) is explored
  initFog(world);

  // Spawn starting bees
  spawnStartingBees(world);
}

function placeHive(world: World): void {
  // Entrance at origin
  const entrance = world.grid.get(0, 0)!;
  entrance.terrain = TerrainType.HiveEntrance;

  // Ring-1: 2 honey storage, 1 pollen storage, 1 processing, 2 brood
  const ring = hexRing(0, 0, 1);
  const assignments: TerrainType[] = [
    TerrainType.HoneyStorage,
    TerrainType.HoneyStorage,
    TerrainType.Processing,
    TerrainType.Brood,
    TerrainType.Brood,
    TerrainType.PollenStorage,
  ];
  for (let i = 0; i < ring.length; i++) {
    const cell = world.grid.get(ring[i].q, ring[i].r)!;
    cell.terrain = assignments[i];
  }
}

function placeFlowers(world: World): void {
  const placed: { q: number; r: number }[] = [];

  // Meadow flowers
  for (let i = 0; i < FLOWER_CLUSTER_COUNT; i++) {
    placeFlowerCluster(world, placed, FLOWER_MIN_DISTANCE, BIOME_MEADOW_RADIUS, i);
  }

  // Forest flowers (sparser, further out)
  for (let i = 0; i < FOREST_FLOWER_CLUSTER_COUNT; i++) {
    placeFlowerCluster(world, placed, BIOME_MEADOW_RADIUS, BIOME_FOREST_RADIUS, FLOWER_CLUSTER_COUNT + i);
  }
}

function placeFlowerCluster(
  world: World,
  placed: { q: number; r: number }[],
  minDist: number,
  maxDist: number,
  colorIndex: number,
): void {
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const fq = Math.round(Math.cos(angle) * dist * 0.67);
    const fr = Math.round(Math.sin(angle) * dist * 0.67 - fq * 0.5);

    if (hexDistance(0, 0, fq, fr) < minDist) continue;
    if (hexDistance(0, 0, fq, fr) > maxDist) continue;

    let tooClose = false;
    for (const p of placed) {
      if (hexDistance(p.q, p.r, fq, fr) < 3) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const color = FLOWER_COLORS[colorIndex % FLOWER_COLORS.length];
    const clusterHexes = [...hexRing(fq, fr, 0), ...hexRing(fq, fr, 1)];
    for (const h of clusterHexes) {
      const cell = world.grid.get(h.q, h.r);
      if (cell && cell.terrain === TerrainType.Grass) {
        cell.terrain = TerrainType.Flower;
        cell.nectarMax = INITIAL_NECTAR_MIN + Math.random() * (INITIAL_NECTAR_MAX - INITIAL_NECTAR_MIN);
        cell.nectarAmount = cell.nectarMax;
        cell.pollenMax = INITIAL_POLLEN_MIN + Math.random() * (INITIAL_POLLEN_MAX - INITIAL_POLLEN_MIN);
        cell.pollenAmount = cell.pollenMax;
        cell.flowerColor = color;
      }
    }

    placed.push({ q: fq, r: fr });
    break;
  }
}

function placeTrees(world: World): void {
  const placed: { q: number; r: number }[] = [];

  for (let i = 0; i < TREE_CLUSTER_COUNT; i++) {
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = BIOME_MEADOW_RADIUS + Math.random() * (BIOME_FOREST_RADIUS - BIOME_MEADOW_RADIUS);
      const tq = Math.round(Math.cos(angle) * dist * 0.67);
      const tr = Math.round(Math.sin(angle) * dist * 0.67 - tq * 0.5);

      if (hexDistance(0, 0, tq, tr) < BIOME_MEADOW_RADIUS) continue;
      if (hexDistance(0, 0, tq, tr) > BIOME_FOREST_RADIUS) continue;

      let tooClose = false;
      for (const p of placed) {
        if (hexDistance(p.q, p.r, tq, tr) < 3) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const clusterHexes = [...hexRing(tq, tr, 0), ...hexRing(tq, tr, 1)];
      for (const h of clusterHexes) {
        const cell = world.grid.get(h.q, h.r);
        if (cell && cell.terrain === TerrainType.Grass) {
          if (Math.random() < 0.7) {
            cell.terrain = TerrainType.Tree;
            cell.resinMax = 0.5 + Math.random() * 0.5;
            cell.resinAmount = cell.resinMax;
          }
        }
      }

      placed.push({ q: tq, r: tr });
      break;
    }
  }
}

function placeWater(world: World): void {
  const placed: { q: number; r: number }[] = [];

  for (let i = 0; i < WATER_CLUSTER_COUNT; i++) {
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = BIOME_FOREST_RADIUS + Math.random() * (WORLD_RADIUS - BIOME_FOREST_RADIUS);
      const wq = Math.round(Math.cos(angle) * dist * 0.67);
      const wr = Math.round(Math.sin(angle) * dist * 0.67 - wq * 0.5);

      if (hexDistance(0, 0, wq, wr) < BIOME_FOREST_RADIUS) continue;
      if (hexDistance(0, 0, wq, wr) > WORLD_RADIUS - 2) continue;

      let tooClose = false;
      for (const p of placed) {
        if (hexDistance(p.q, p.r, wq, wr) < 4) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const clusterHexes = [...hexRing(wq, wr, 0), ...hexRing(wq, wr, 1), ...hexRing(wq, wr, 2)];
      for (const h of clusterHexes) {
        const cell = world.grid.get(h.q, h.r);
        if (cell && cell.terrain === TerrainType.Grass) {
          const d = hexDistance(wq, wr, h.q, h.r);
          if (d <= 1 || Math.random() < 0.5) {
            cell.terrain = TerrainType.Water;
          }
        }
      }

      placed.push({ q: wq, r: wr });
      break;
    }
  }
}

function initFog(world: World): void {
  // Reveal radius 6 so foragers can see nearby flower clusters (min distance 4)
  for (const h of hexDisk(0, 0, 6)) {
    const cell = world.grid.get(h.q, h.r);
    if (cell) cell.explored = true;
  }
}

function spawnStartingBees(world: World): void {
  const roles: { role: BeeRole; count: number }[] = [
    { role: BeeRole.Forager, count: STARTING_FORAGERS },
    { role: BeeRole.Nurse, count: STARTING_NURSES },
    { role: BeeRole.Scout, count: STARTING_SCOUTS },
    { role: BeeRole.Builder, count: STARTING_BUILDERS },
  ];

  for (const { role, count } of roles) {
    for (let i = 0; i < count; i++) {
      createBee(world, role, 0, 0);
    }
  }
}

export function createBee(world: World, role: BeeRole, q: number, r: number): BeeEntity {
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
    stateTimer: 0,
    wingPhase: Math.random() * Math.PI * 2,
  };
  world.bees.push(bee);
  return bee;
}
