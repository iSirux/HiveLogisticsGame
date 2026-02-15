import { BeeEntity, BeeRole, BeeState, TerrainType, HexCell } from '../types';
import { World } from '../world/world';
import { hexDistance, hexNeighbors } from '../hex/hex';
import {
  HARVEST_TICKS, DEPOSIT_TICKS, NECTAR_PER_HARVEST, POLLEN_PER_HARVEST, BEE_CARRY_CAPACITY,
  SCORE_DISTANCE_WEIGHT, SCORE_PHEROMONE_WEIGHT, SCORE_NECTAR_WEIGHT, SCORE_POLLEN_WEIGHT, SCORE_JITTER,
  TEND_TICKS, BROOD_TEND_AMOUNT, BROOD_HONEY_COST, BROOD_BEE_BREAD_COST, PROCESS_TICKS, PROCESSING_RATE,
  NECTAR_TO_HONEY_RATIO, NIGHT_START, DAWN_END,
  SCOUT_EXPLORE_RANGE, WAGGLE_DANCE_TICKS, POLLEN_STORAGE_CAPACITY,
} from '../constants';

export function updateBeeAI(bee: BeeEntity, world: World): void {
  // Night behavior: all bees return to hive and rest
  const isNight = world.dayProgress >= NIGHT_START || world.dayProgress < DAWN_END;

  if (isNight && bee.state !== BeeState.Resting && bee.state !== BeeState.ReturningToHive && bee.state !== BeeState.Depositing) {
    if (bee.q === 0 && bee.r === 0) {
      bee.state = BeeState.Resting;
      bee.path = [];
      return;
    }
    // Head home
    bee.state = BeeState.ReturningToHive;
    bee.path = computePath(bee.q, bee.r, 0, 0, world);
    return;
  }

  // Dawn: wake up
  if (!isNight && bee.state === BeeState.Resting) {
    bee.state = BeeState.Idle;
    return;
  }

  switch (bee.role) {
    case BeeRole.Forager:
      updateForager(bee, world);
      break;
    case BeeRole.Nurse:
      updateNurse(bee, world);
      break;
    case BeeRole.Scout:
      updateScout(bee, world);
      break;
    case BeeRole.Builder:
      updateBuilder(bee, world);
      break;
  }
}

function updateForager(bee: BeeEntity, world: World): void {
  switch (bee.state) {
    case BeeState.Idle: {
      const flower = findBestFlower(bee, world);
      if (flower) {
        bee.targetQ = flower.q;
        bee.targetR = flower.r;
        bee.state = BeeState.FlyingToFlower;
        bee.path = computePath(bee.q, bee.r, flower.q, flower.r, world);
      }
      break;
    }

    case BeeState.FlyingToFlower: {
      if (bee.path.length === 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.terrain === TerrainType.Flower && cell.nectarAmount > 0.01) {
          bee.state = BeeState.Harvesting;
          bee.stateTimer = HARVEST_TICKS;
        } else {
          bee.state = BeeState.Idle;
        }
      }
      break;
    }

    case BeeState.Harvesting: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell) {
          // Harvest nectar
          const nectarHarvest = Math.min(NECTAR_PER_HARVEST, cell.nectarAmount, BEE_CARRY_CAPACITY - bee.carrying.nectar);
          cell.nectarAmount -= nectarHarvest;
          bee.carrying.nectar += nectarHarvest;

          // Harvest pollen alongside
          const pollenHarvest = Math.min(POLLEN_PER_HARVEST, cell.pollenAmount, BEE_CARRY_CAPACITY - bee.carrying.pollen);
          cell.pollenAmount -= pollenHarvest;
          bee.carrying.pollen += pollenHarvest;
        }
        bee.state = BeeState.ReturningToHive;
        bee.path = computePath(bee.q, bee.r, 0, 0, world);
        world.pendingSounds.push('harvest');
      }
      break;
    }

    case BeeState.ReturningToHive: {
      if (bee.path.length === 0) {
        if (bee.carrying.nectar > 0 || bee.carrying.pollen > 0) {
          bee.state = BeeState.Depositing;
          bee.stateTimer = DEPOSIT_TICKS;
        } else {
          bee.state = BeeState.Idle;
        }
      }
      break;
    }

    case BeeState.Depositing: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        // Deposit nectar to processing cells
        if (bee.carrying.nectar > 0) {
          const processingCells = world.grid.cellsOfType(TerrainType.Processing);
          for (const cell of processingCells) {
            const space = 3 - cell.nectarStored;
            if (space > 0) {
              const amount = Math.min(bee.carrying.nectar, space);
              cell.nectarStored += amount;
              world.resources.nectar += amount;
              bee.carrying.nectar -= amount;
              break;
            }
          }
          bee.carrying.nectar = 0;
        }

        // Deposit pollen to pollen storage cells
        if (bee.carrying.pollen > 0) {
          const pollenCells = world.grid.cellsOfType(TerrainType.PollenStorage);
          for (const cell of pollenCells) {
            const space = POLLEN_STORAGE_CAPACITY - cell.pollenStored;
            if (space > 0) {
              const amount = Math.min(bee.carrying.pollen, space);
              cell.pollenStored += amount;
              bee.carrying.pollen -= amount;
              break;
            }
          }
          bee.carrying.pollen = 0;
        }

        bee.state = BeeState.Idle;
      }
      break;
    }
  }
}

function updateNurse(bee: BeeEntity, world: World): void {
  switch (bee.state) {
    case BeeState.Idle: {
      // Priority 1: tend brood that needs care
      const broodCell = findBroodNeedingCare(world);
      if (broodCell) {
        bee.targetQ = broodCell.q;
        bee.targetR = broodCell.r;
        bee.state = BeeState.FlyingToBrood;
        bee.path = computePath(bee.q, bee.r, broodCell.q, broodCell.r, world);
        break;
      }
      // Priority 2: help process nectar
      const procCell = findProcessingCell(world);
      if (procCell) {
        bee.targetQ = procCell.q;
        bee.targetR = procCell.r;
        bee.state = BeeState.FlyingToProcessing;
        bee.path = computePath(bee.q, bee.r, procCell.q, procCell.r, world);
        break;
      }
      // Priority 3: activate empty brood cells if we have honey AND bee bread
      const emptyBrood = findEmptyBrood(world);
      if (emptyBrood && world.resources.honey >= BROOD_HONEY_COST && world.resources.beeBread >= BROOD_BEE_BREAD_COST) {
        if (world.deductHoney(BROOD_HONEY_COST) && world.deductBeeBread(BROOD_BEE_BREAD_COST)) {
          emptyBrood.broodActive = true;
          emptyBrood.broodProgress = 0;
        }
      }
      break;
    }

    case BeeState.FlyingToBrood: {
      if (bee.path.length === 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.terrain === TerrainType.Brood && cell.broodActive) {
          bee.state = BeeState.Tending;
          bee.stateTimer = TEND_TICKS;
        } else {
          bee.state = BeeState.Idle;
        }
      }
      break;
    }

    case BeeState.Tending: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.broodActive) {
          cell.broodProgress += BROOD_TEND_AMOUNT;
        }
        bee.state = BeeState.Idle;
      }
      break;
    }

    case BeeState.FlyingToProcessing: {
      if (bee.path.length === 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.terrain === TerrainType.Processing && cell.nectarStored > 0) {
          bee.state = BeeState.Processing;
          bee.stateTimer = PROCESS_TICKS;
        } else {
          bee.state = BeeState.Idle;
        }
      }
      break;
    }

    case BeeState.Processing: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.nectarStored > 0) {
          const processed = Math.min(PROCESSING_RATE * 5, cell.nectarStored);
          cell.nectarStored -= processed;
          const honeyProduced = processed * NECTAR_TO_HONEY_RATIO;

          const storageCells = world.grid.cellsOfType(TerrainType.HoneyStorage);
          for (const sc of storageCells) {
            const space = 5 - sc.honeyStored;
            if (space > 0) {
              const amount = Math.min(honeyProduced, space);
              sc.honeyStored += amount;
              world.resources.honey += amount;
              world.resources.nectar -= processed;
              break;
            }
          }
        }
        bee.state = BeeState.Idle;
      }
      break;
    }
  }
}

function updateScout(bee: BeeEntity, world: World): void {
  switch (bee.state) {
    case BeeState.Idle: {
      const target = findUnexploredTarget(bee, world);
      if (target) {
        bee.explorationTarget = target;
        bee.targetQ = target.q;
        bee.targetR = target.r;
        bee.state = BeeState.FlyingToExplore;
        bee.path = computePath(bee.q, bee.r, target.q, target.r, world);
      }
      break;
    }

    case BeeState.FlyingToExplore: {
      if (bee.path.length === 0) {
        bee.state = BeeState.Exploring;
        bee.stateTimer = 10;
      }
      break;
    }

    case BeeState.Exploring: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        bee.state = BeeState.ReturningToHive;
        bee.path = computePath(bee.q, bee.r, 0, 0, world);
      }
      break;
    }

    case BeeState.ReturningToHive: {
      if (bee.path.length === 0) {
        bee.state = BeeState.WaggleDancing;
        bee.danceTicks = WAGGLE_DANCE_TICKS;
      }
      break;
    }

    case BeeState.WaggleDancing: {
      bee.danceTicks--;
      if (bee.danceTicks <= 0) {
        bee.explorationTarget = null;
        bee.state = BeeState.Idle;
      }
      break;
    }
  }
}

function updateBuilder(bee: BeeEntity, world: World): void {
  if (bee.state === BeeState.Idle) {
    bee.state = BeeState.IdleAtHive;
  }
  if (bee.state === BeeState.IdleAtHive && (bee.q !== 0 || bee.r !== 0)) {
    bee.path = computePath(bee.q, bee.r, 0, 0, world);
    bee.state = BeeState.ReturningToHive;
  }
  if (bee.state === BeeState.ReturningToHive && bee.path.length === 0) {
    bee.state = BeeState.IdleAtHive;
  }
}

function findBestFlower(bee: BeeEntity, world: World): HexCell | null {
  const flowers = world.grid.cellsOfType(TerrainType.Flower);
  let best: HexCell | null = null;
  let bestScore = -Infinity;

  for (const f of flowers) {
    if (!f.explored) continue;
    if (f.nectarAmount < 0.01 && f.pollenAmount < 0.01) continue;
    const dist = hexDistance(bee.q, bee.r, f.q, f.r);
    const nectarRatio = f.nectarMax > 0 ? f.nectarAmount / f.nectarMax : 0;
    const pollenRatio = f.pollenMax > 0 ? f.pollenAmount / f.pollenMax : 0;
    const score = SCORE_DISTANCE_WEIGHT * dist
      + SCORE_PHEROMONE_WEIGHT * f.pheromone
      + SCORE_NECTAR_WEIGHT * nectarRatio
      + SCORE_POLLEN_WEIGHT * pollenRatio
      + SCORE_JITTER * (Math.random() - 0.5);

    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function findBroodNeedingCare(world: World): HexCell | null {
  const broods = world.grid.cellsOfType(TerrainType.Brood);
  for (const b of broods) {
    if (b.broodActive && b.broodProgress < 1) return b;
  }
  return null;
}

function findProcessingCell(world: World): HexCell | null {
  const cells = world.grid.cellsOfType(TerrainType.Processing);
  for (const c of cells) {
    if (c.nectarStored > 0.01) return c;
  }
  return null;
}

function findEmptyBrood(world: World): HexCell | null {
  const broods = world.grid.cellsOfType(TerrainType.Brood);
  for (const b of broods) {
    if (!b.broodActive) return b;
  }
  return null;
}

function findUnexploredTarget(bee: BeeEntity, world: World): { q: number; r: number } | null {
  let best: { q: number; r: number } | null = null;
  let bestScore = -Infinity;

  for (const cell of world.grid.cells.values()) {
    if (cell.explored) continue;
    const dist = hexDistance(0, 0, cell.q, cell.r);
    if (dist > SCOUT_EXPLORE_RANGE) continue;

    // Prefer hexes adjacent to explored area (frontier)
    const neighbors = hexNeighbors(cell.q, cell.r);
    let nearExplored = false;
    for (const n of neighbors) {
      const nc = world.grid.get(n.q, n.r);
      if (nc && nc.explored) { nearExplored = true; break; }
    }
    if (!nearExplored) continue;

    const beeDist = hexDistance(bee.q, bee.r, cell.q, cell.r);
    const score = -beeDist + Math.random() * 5;

    if (score > bestScore) {
      bestScore = score;
      best = { q: cell.q, r: cell.r };
    }
  }
  return best;
}

/** Greedy walk: pick neighbor closest to target each step */
export function computePath(fromQ: number, fromR: number, toQ: number, toR: number, _world: World): { q: number; r: number }[] {
  const path: { q: number; r: number }[] = [];
  let cq = fromQ;
  let cr = fromR;

  const maxSteps = hexDistance(fromQ, fromR, toQ, toR) + 5;
  for (let i = 0; i < maxSteps; i++) {
    if (cq === toQ && cr === toR) break;

    const neighbors = hexNeighbors(cq, cr);
    let bestDist = Infinity;
    let bestN = neighbors[0];

    for (const n of neighbors) {
      const d = hexDistance(n.q, n.r, toQ, toR);
      if (d < bestDist) {
        bestDist = d;
        bestN = n;
      }
    }

    path.push(bestN);
    cq = bestN.q;
    cr = bestN.r;
  }

  return path;
}
