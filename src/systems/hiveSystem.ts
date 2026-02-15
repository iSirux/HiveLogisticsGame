import { World } from '../world/world';
import { TerrainType, BeeRole } from '../types';
import {
  PROCESSING_RATE, NECTAR_TO_HONEY_RATIO, HONEY_STORAGE_CAPACITY,
  BROOD_HATCH_THRESHOLD, WAX_PER_TICK,
  POLLEN_TO_BEE_BREAD_RATE, POLLEN_TO_BEE_BREAD_RATIO,
} from '../constants';
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

  // === Pollen → Bee Bread fermentation in pollen storage cells ===
  const pollenCells = world.grid.cellsOfType(TerrainType.PollenStorage);
  for (const cell of pollenCells) {
    if (cell.pollenStored <= 0) continue;

    const converted = Math.min(POLLEN_TO_BEE_BREAD_RATE, cell.pollenStored);
    cell.pollenStored -= converted;
    world.resources.beeBread += converted * POLLEN_TO_BEE_BREAD_RATIO;
  }

  // === Brood hatching ===
  const broodCells = world.grid.cellsOfType(TerrainType.Brood);
  for (const cell of broodCells) {
    if (!cell.broodActive) continue;
    if (cell.broodProgress >= BROOD_HATCH_THRESHOLD) {
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
  let pollenTotal = 0;
  for (const cell of storageCells) honeyTotal += cell.honeyStored;
  for (const cell of processingCells) nectarTotal += cell.nectarStored;
  for (const cell of pollenCells) pollenTotal += cell.pollenStored;
  // Also count resources being carried by bees
  for (const bee of world.bees) {
    nectarTotal += bee.carrying.nectar;
    pollenTotal += bee.carrying.pollen;
  }
  world.resources.honey = honeyTotal;
  world.resources.nectar = nectarTotal;
  world.resources.pollen = pollenTotal;
}
