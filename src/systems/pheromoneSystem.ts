import { World } from '../world/world';
import { PHEROMONE_DECAY_RATE } from '../constants';

export function updatePheromones(world: World): void {
  for (const cell of world.grid.cells.values()) {
    if (cell.pheromone > 0) {
      cell.pheromone = Math.max(0, cell.pheromone - PHEROMONE_DECAY_RATE);
    }
  }
}
