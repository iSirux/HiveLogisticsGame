import { BeeEntity, BeeRole, BeeState, TerrainType, HexCell } from '../types';
import { World } from '../world/world';
import { hexDistance, hexNeighbors } from '../hex/hex';
import {
  HARVEST_TICKS, DEPOSIT_TICKS, NECTAR_PER_HARVEST, BEE_CARRY_CAPACITY,
  SCORE_DISTANCE_WEIGHT, SCORE_PHEROMONE_WEIGHT, SCORE_NECTAR_WEIGHT, SCORE_JITTER,
  TEND_TICKS, BROOD_TEND_AMOUNT, BROOD_HONEY_COST, PROCESS_TICKS, PROCESSING_RATE,
  NECTAR_TO_HONEY_RATIO, NIGHT_START, DAWN_END,
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
        // Arrived at flower
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.terrain === TerrainType.Flower && cell.nectarAmount > 0.01) {
          bee.state = BeeState.Harvesting;
          bee.stateTimer = HARVEST_TICKS;
        } else {
          // Flower is depleted, find another
          bee.state = BeeState.Idle;
        }
      }
      break;
    }

    case BeeState.Harvesting: {
      bee.stateTimer--;
      if (bee.stateTimer <= 0) {
        // Harvest nectar
        const cell = world.grid.get(bee.q, bee.r);
        if (cell) {
          const harvest = Math.min(NECTAR_PER_HARVEST, cell.nectarAmount, BEE_CARRY_CAPACITY - bee.carryingNectar);
          cell.nectarAmount -= harvest;
          bee.carryingNectar += harvest;
        }
        // Return to hive
        bee.state = BeeState.ReturningToHive;
        bee.path = computePath(bee.q, bee.r, 0, 0, world);
        world.pendingSounds.push('harvest');
      }
      break;
    }

    case BeeState.ReturningToHive: {
      if (bee.path.length === 0) {
        if (bee.carryingNectar > 0) {
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
        // Find a processing cell with capacity
        const processingCells = world.grid.cellsOfType(TerrainType.Processing);
        let deposited = false;
        for (const cell of processingCells) {
          const space = 3 - cell.nectarStored; // capacity 3
          if (space > 0) {
            const amount = Math.min(bee.carryingNectar, space);
            cell.nectarStored += amount;
            world.resources.nectar += amount;
            bee.carryingNectar -= amount;
            deposited = true;
            break;
          }
        }
        if (!deposited) {
          // No room — bee keeps carrying nectar and goes idle to retry later
        } else {
          bee.carryingNectar = 0;
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
      // Priority 3: activate empty brood cells if we have honey
      const emptyBrood = findEmptyBrood(world);
      if (emptyBrood && world.resources.honey >= BROOD_HONEY_COST) {
        // Deduct honey from storage cells (not just global counter)
        if (world.deductHoney(BROOD_HONEY_COST)) {
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
        // Nurse speeds up processing
        const cell = world.grid.get(bee.q, bee.r);
        if (cell && cell.nectarStored > 0) {
          const processed = Math.min(PROCESSING_RATE * 5, cell.nectarStored);
          cell.nectarStored -= processed;
          const honeyProduced = processed * NECTAR_TO_HONEY_RATIO;

          // Find storage cell
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

function updateBuilder(bee: BeeEntity, world: World): void {
  // Builder: just idle at hive for now
  if (bee.state === BeeState.Idle) {
    bee.state = BeeState.IdleAtHive;
  }
  // Stay at hive
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
    if (f.nectarAmount < 0.01) continue;
    const dist = hexDistance(bee.q, bee.r, f.q, f.r);
    const nectarRatio = f.nectarAmount / f.nectarMax;
    const score = SCORE_DISTANCE_WEIGHT * dist
      + SCORE_PHEROMONE_WEIGHT * f.pheromone
      + SCORE_NECTAR_WEIGHT * nectarRatio
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

/** Greedy walk: pick neighbor closest to target each step */
export function computePath(fromQ: number, fromR: number, toQ: number, toR: number, _world: World): { q: number; r: number }[] {
  const path: { q: number; r: number }[] = [];
  let cq = fromQ;
  let cr = fromR;

  const maxSteps = hexDistance(fromQ, fromR, toQ, toR) + 5; // safety margin
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
