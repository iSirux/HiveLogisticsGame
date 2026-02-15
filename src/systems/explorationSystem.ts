import { World } from '../world/world';
import { BeeRole, BeeState } from '../types';
import { hexDisk } from '../hex/hex';
import { SCOUT_VISION_RADIUS, WAGGLE_DANCE_REVEAL_RADIUS } from '../constants';

export function updateExploration(world: World): void {
  for (const bee of world.bees) {
    if (bee.role !== BeeRole.Scout) continue;

    // Reveal hexes around scout while flying to explore or actively exploring
    if (bee.state === BeeState.FlyingToExplore || bee.state === BeeState.Exploring) {
      revealArea(world, bee.q, bee.r, SCOUT_VISION_RADIUS);
    }

    // During waggle dance, reveal area around the exploration target
    if (bee.state === BeeState.WaggleDancing && bee.explorationTarget) {
      revealArea(world, bee.explorationTarget.q, bee.explorationTarget.r, WAGGLE_DANCE_REVEAL_RADIUS);
    }
  }
}

function revealArea(world: World, cq: number, cr: number, radius: number): void {
  for (const h of hexDisk(cq, cr, radius)) {
    const cell = world.grid.get(h.q, h.r);
    if (cell && !cell.explored) {
      cell.explored = true;
      world.explorationVersion++;
    }
  }
}
