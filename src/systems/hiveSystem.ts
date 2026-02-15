import { World } from '../world/world';
import { TerrainType, BeeRole } from '../types';
import { PROCESSING_RATE, NECTAR_TO_HONEY_RATIO, HONEY_STORAGE_CAPACITY, BROOD_HATCH_THRESHOLD, WAX_PER_TICK } from '../constants';
import { createBee } from '../world/worldGen';
import { assignRoleFromRatios } from '../entities/entityManager';

export function updateHive(world: World): void {
  // === Process nectar → honey in processing cells ===
  const processingCells = world.grid.cellsOfType(TerrainType.Processing);
  const storageCells = world.grid.cellsOfType(TerrainType.HoneyStorage);

  for (const cell of processingCells) {
    if (cell.nectarStored <= 0) continue;

    const processed = Math.min(PROCESSING_RATE, cell.nectarStored);
    cell.nectarStored -= processed;
    const honeyProduced = processed * NECTAR_TO_HONEY_RATIO;

    // Move honey to storage
    for (const sc of storageCells) {
      const space = HONEY_STORAGE_CAPACITY - sc.honeyStored;
      if (space > 0) {
        const amount = Math.min(honeyProduced, space);
        sc.honeyStored += amount;
        break;
      }
    }
  }

  // === Brood hatching ===
  const broodCells = world.grid.cellsOfType(TerrainType.Brood);
  for (const cell of broodCells) {
    if (!cell.broodActive) continue;
    if (cell.broodProgress >= BROOD_HATCH_THRESHOLD) {
      // Hatch a new bee!
      const newBee = createBee(world, BeeRole.Forager, cell.q, cell.r);
      assignRoleFromRatios(world, newBee);
      cell.broodActive = false;
      cell.broodProgress = 0;
      world.pendingSounds.push('hatch');
    }
  }

  // === Passive wax production from honey ===
  const totalHoney = storageCells.reduce((sum, c) => sum + c.honeyStored, 0);
  if (totalHoney > 0) {
    world.resources.wax += WAX_PER_TICK;
  }

  // === Recalculate global resource counts from cells ===
  let honeyTotal = 0;
  let nectarTotal = 0;
  for (const cell of storageCells) honeyTotal += cell.honeyStored;
  for (const cell of processingCells) nectarTotal += cell.nectarStored;
  // Also count nectar being carried by bees
  for (const bee of world.bees) nectarTotal += bee.carryingNectar;
  world.resources.honey = honeyTotal;
  world.resources.nectar = nectarTotal;
}
