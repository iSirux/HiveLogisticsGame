import { World } from './world';
import { TerrainType, BeeRole, BeeState, BeeEntity } from '../types';
import { hexToPixel, hexRing, hexDisk, hexDistance } from '../hex/hex';
import {
  WORLD_RADIUS, FLOWER_CLUSTER_COUNT, FLOWER_MIN_DISTANCE,
  FLOWER_MAX_DISTANCE, INITIAL_NECTAR_MIN, INITIAL_NECTAR_MAX,
  STARTING_FORAGERS, STARTING_NURSES, STARTING_BUILDERS,
} from '../constants';

const FLOWER_COLORS = ['#ff69b4', '#ff6090', '#e060e0', '#c070ff', '#ff8040', '#ff5050'];

export function generateWorld(world: World): void {
  // Fill grass hexes
  for (const h of hexDisk(0, 0, WORLD_RADIUS)) {
    world.grid.createCell(h.q, h.r, TerrainType.Grass);
  }

  // Place hive at origin
  placeHive(world);

  // Scatter flower clusters
  placeFlowers(world);

  // Spawn starting bees
  spawnStartingBees(world);
}

function placeHive(world: World): void {
  // Entrance at origin
  const entrance = world.grid.get(0, 0)!;
  entrance.terrain = TerrainType.HiveEntrance;

  // Ring-1: 2 honey storage, 1 processing, 2 brood
  const ring = hexRing(0, 0, 1);
  const assignments: TerrainType[] = [
    TerrainType.HoneyStorage,
    TerrainType.HoneyStorage,
    TerrainType.Processing,
    TerrainType.Brood,
    TerrainType.Brood,
    TerrainType.Processing,
  ];
  for (let i = 0; i < ring.length; i++) {
    const cell = world.grid.get(ring[i].q, ring[i].r)!;
    cell.terrain = assignments[i];
  }
}

function placeFlowers(world: World): void {
  const placed: { q: number; r: number }[] = [];

  for (let i = 0; i < FLOWER_CLUSTER_COUNT; i++) {
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      // Random hex within range
      const angle = Math.random() * Math.PI * 2;
      const dist = FLOWER_MIN_DISTANCE + Math.random() * (FLOWER_MAX_DISTANCE - FLOWER_MIN_DISTANCE);
      const fq = Math.round(Math.cos(angle) * dist * 0.67);
      const fr = Math.round(Math.sin(angle) * dist * 0.67 - fq * 0.5);

      // Check distance from hive and other clusters
      if (hexDistance(0, 0, fq, fr) < FLOWER_MIN_DISTANCE) continue;
      if (hexDistance(0, 0, fq, fr) > FLOWER_MAX_DISTANCE) continue;

      let tooClose = false;
      for (const p of placed) {
        if (hexDistance(p.q, p.r, fq, fr) < 3) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Place cluster: center + ring 1
      const color = FLOWER_COLORS[i % FLOWER_COLORS.length];
      const clusterHexes = [...hexRing(fq, fr, 0), ...hexRing(fq, fr, 1)];
      for (const h of clusterHexes) {
        const cell = world.grid.get(h.q, h.r);
        if (cell && cell.terrain === TerrainType.Grass) {
          cell.terrain = TerrainType.Flower;
          cell.nectarMax = INITIAL_NECTAR_MIN + Math.random() * (INITIAL_NECTAR_MAX - INITIAL_NECTAR_MIN);
          cell.nectarAmount = cell.nectarMax;
          cell.flowerColor = color;
        }
      }

      placed.push({ q: fq, r: fr });
      break;
    }
  }
}

function spawnStartingBees(world: World): void {
  const roles: { role: BeeRole; count: number }[] = [
    { role: BeeRole.Forager, count: STARTING_FORAGERS },
    { role: BeeRole.Nurse, count: STARTING_NURSES },
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
  // Add slight random offset so bees don't stack
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
    carryingNectar: 0,
    targetQ: 0,
    targetR: 0,
    stateTimer: 0,
    wingPhase: Math.random() * Math.PI * 2,
  };
  world.bees.push(bee);
  return bee;
}
