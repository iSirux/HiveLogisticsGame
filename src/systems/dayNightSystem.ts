import { World } from '../world/world';
import { DAY_CYCLE_TICKS, FLOWER_REGROWTH_RATE, FLOWER_POLLEN_REGROWTH_RATE } from '../constants';
import { TerrainType } from '../types';

export function updateDayNight(world: World): void {
  world.dayProgress += 1 / DAY_CYCLE_TICKS;
  if (world.dayProgress >= 1) {
    world.dayProgress -= 1;
    world.dayCount++;
  }

  // Flower regrowth (nectar + pollen)
  for (const cell of world.grid.cells.values()) {
    if (cell.terrain === TerrainType.Flower) {
      if (cell.nectarAmount < cell.nectarMax) {
        cell.nectarAmount = Math.min(cell.nectarMax, cell.nectarAmount + FLOWER_REGROWTH_RATE);
      }
      if (cell.pollenAmount < cell.pollenMax) {
        cell.pollenAmount = Math.min(cell.pollenMax, cell.pollenAmount + FLOWER_POLLEN_REGROWTH_RATE);
      }
    }
  }
}
