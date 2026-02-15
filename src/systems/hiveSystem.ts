import { World } from '../world/world';
import { TerrainType, BeeRole } from '../types';
import {
  PROCESSING_RATE, NECTAR_TO_HONEY_RATIO, HONEY_STORAGE_CAPACITY,
  BROOD_HATCH_THRESHOLD, WAX_PER_TICK,
  POLLEN_TO_BEE_BREAD_RATE, POLLEN_TO_BEE_BREAD_RATIO,
  WAX_WORKS_PASSIVE_RATE, WAX_WORKS_HONEY_TO_WAX_RATIO, WAX_WORKS_HONEY_CAPACITY,
  NECTAR_STORAGE_CAPACITY, NECTAR_CELL_CAPACITY, POLLEN_STORAGE_CAPACITY,
  WAYSTATION_OVERFLOW_RATE, WAYSTATION_NECTAR_CAPACITY, WAYSTATION_POLLEN_CAPACITY,
} from '../constants';
import { hexNeighbors, hexKey } from '../hex/hex';
import { createBee } from '../world/worldGen';
import { assignRoleFromCounts } from '../entities/entityManager';

export function updateHive(world: World): void {
  // === Storage cells adjacent to waystations are excluded from hive processing ===
  const waystations = world.grid.waystationCells();
  const waystationAdjacentKeys = world.grid.waystationAdjacentStorageKeys();

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

  // === Feed processing cells from nectar storage (hive-only) ===
  const nectarStorageCells = world.grid.cellsOfType(TerrainType.NectarStorage)
    .filter(c => !waystationAdjacentKeys.has(hexKey(c.q, c.r)));
  for (const proc of processingCells) {
    const space = NECTAR_STORAGE_CAPACITY - proc.nectarStored;
    if (space <= 0.01) continue;
    for (const ns of nectarStorageCells) {
      if (ns.nectarStored <= 0.01) continue;
      const transfer = Math.min(space, ns.nectarStored);
      ns.nectarStored -= transfer;
      proc.nectarStored += transfer;
      break;
    }
  }

  // === Pollen → Bee Bread fermentation in pollen storage cells (hive-only) ===
  const pollenCells = world.grid.cellsOfType(TerrainType.PollenStorage)
    .filter(c => !waystationAdjacentKeys.has(hexKey(c.q, c.r)));
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
      assignRoleFromCounts(world, newBee);
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

  // === Wax Works: distribute honey from storage → wax works cells ===
  const waxWorksCells = world.grid.cellsOfType(TerrainType.WaxWorks);
  for (const ww of waxWorksCells) {
    const space = WAX_WORKS_HONEY_CAPACITY - ww.honeyStored;
    if (space <= 0.01) continue;
    for (const sc of storageCells) {
      if (sc.honeyStored <= 0.01) continue;
      const transfer = Math.min(space, sc.honeyStored);
      sc.honeyStored -= transfer;
      ww.honeyStored += transfer;
      break;
    }
  }

  // === Wax Works: passive honey → wax conversion ===
  for (const ww of waxWorksCells) {
    if (ww.honeyStored <= 0) continue;
    const consumed = Math.min(WAX_WORKS_PASSIVE_RATE, ww.honeyStored);
    ww.honeyStored -= consumed;
    world.resources.wax += consumed * WAX_WORKS_HONEY_TO_WAX_RATIO;
  }

  // === Waystation ↔ adjacent storage exchange ===
  for (const ws of waystations) {
    const neighbors = hexNeighbors(ws.q, ws.r);
    for (const nb of neighbors) {
      const cell = world.grid.get(nb.q, nb.r);
      if (!cell) continue;

      // --- Nectar: NectarStorage adjacent to waystation ---
      if (cell.terrain === TerrainType.NectarStorage) {
        if (ws.nectarStored > 0) {
          // Overflow: waystation → storage when waystation has resources
          const space = NECTAR_CELL_CAPACITY - cell.nectarStored;
          if (space > 0.001) {
            const transfer = Math.min(WAYSTATION_OVERFLOW_RATE, ws.nectarStored, space);
            ws.nectarStored -= transfer;
            cell.nectarStored += transfer;
          }
        } else if (cell.nectarStored > 0) {
          // Refill: storage → waystation when waystation is empty (so haulers can pick up)
          const wsSpace = WAYSTATION_NECTAR_CAPACITY - ws.nectarStored;
          if (wsSpace > 0.001) {
            const transfer = Math.min(WAYSTATION_OVERFLOW_RATE, cell.nectarStored, wsSpace);
            cell.nectarStored -= transfer;
            ws.nectarStored += transfer;
          }
        }
      }

      // --- Pollen: PollenStorage adjacent to waystation ---
      if (cell.terrain === TerrainType.PollenStorage) {
        if (ws.pollenStored > 0) {
          const space = POLLEN_STORAGE_CAPACITY - cell.pollenStored;
          if (space > 0.001) {
            const transfer = Math.min(WAYSTATION_OVERFLOW_RATE, ws.pollenStored, space);
            ws.pollenStored -= transfer;
            cell.pollenStored += transfer;
          }
        } else if (cell.pollenStored > 0) {
          const wsSpace = WAYSTATION_POLLEN_CAPACITY - ws.pollenStored;
          if (wsSpace > 0.001) {
            const transfer = Math.min(WAYSTATION_OVERFLOW_RATE, cell.pollenStored, wsSpace);
            cell.pollenStored -= transfer;
            ws.pollenStored += transfer;
          }
        }
      }
    }
  }

  // === Recalculate global resource counts from cells ===
  let honeyTotal = 0;
  let nectarTotal = 0;
  let pollenTotal = 0;
  for (const cell of storageCells) honeyTotal += cell.honeyStored;
  for (const cell of processingCells) nectarTotal += cell.nectarStored;
  for (const cell of nectarStorageCells) nectarTotal += cell.nectarStored;
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
