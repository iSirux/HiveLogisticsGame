import { World } from '../world/world';
import { DAY_CYCLE_TICKS, NIGHT_START, DAWN_END, FLOWER_TYPE_CONFIG } from '../constants';
import { TerrainType } from '../types';

export function updateDayNight(world: World): void {
  world.dayProgress += 1 / DAY_CYCLE_TICKS;
  if (world.dayProgress >= 1) {
    world.dayProgress -= 1;
    world.dayCount++;

    // Compute net resource change for the day that just ended
    const r = world.resources;
    const s = world.resourcesAtDayStart;
    world.resourceDeltaYesterday = {
      honey: r.honey - s.honey,
      nectar: r.nectar - s.nectar,
      wax: r.wax - s.wax,
      pollen: r.pollen - s.pollen,
      beeBread: r.beeBread - s.beeBread,
    };
    // Snapshot current resources for the new day
    world.resourcesAtDayStart = { ...r };
  }

  // Flower regrowth only during daytime
  const isNight = world.dayProgress >= NIGHT_START || world.dayProgress < DAWN_END;
  if (isNight) return;

  for (const cell of world.grid.cells.values()) {
    if (cell.terrain === TerrainType.Flower) {
      const cfg = FLOWER_TYPE_CONFIG[cell.flowerType];
      if (cell.nectarAmount < cell.nectarMax) {
        cell.nectarAmount = Math.min(cell.nectarMax, cell.nectarAmount + cfg.regrowthNectar);
      }
      if (cell.pollenAmount < cell.pollenMax && cfg.regrowthPollen > 0) {
        cell.pollenAmount = Math.min(cell.pollenMax, cell.pollenAmount + cfg.regrowthPollen);
      }
    }
  }
}
