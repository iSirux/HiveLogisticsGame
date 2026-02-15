import { World } from '../world/world';
import { updateBeeAI } from '../entities/beeAI';

export function updateForaging(world: World): void {
  for (const bee of world.bees) {
    updateBeeAI(bee, world);
  }
}
