import { DAY_CYCLE_TICKS } from '../constants';
import { FLOWER_REGROWTH_RATE } from '../constants';
import { TerrainType } from '../types';
export function updateDayNight(world) {
    world.dayProgress += 1 / DAY_CYCLE_TICKS;
    if (world.dayProgress >= 1) {
        world.dayProgress -= 1;
        world.dayCount++;
    }
    // Flower regrowth
    for (const cell of world.grid.cells.values()) {
        if (cell.terrain === TerrainType.Flower && cell.nectarAmount < cell.nectarMax) {
            cell.nectarAmount = Math.min(cell.nectarMax, cell.nectarAmount + FLOWER_REGROWTH_RATE);
        }
    }
}
