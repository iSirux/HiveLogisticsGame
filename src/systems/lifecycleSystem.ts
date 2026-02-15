import { World } from '../world/world';
import { BeeState } from '../types';
import {
  ENERGY_DRAIN_FLYING, ENERGY_DRAIN_WORKING, ENERGY_DRAIN_IDLE,
} from '../constants';

const WORKING_STATES = new Set<BeeState>([
  BeeState.Harvesting,
  BeeState.Tending,
  BeeState.Processing,
  BeeState.PickingUp,
]);

/** Slow energy recovery while resting/idle at hive */
const ENERGY_REST_RECOVER = 0.002;

export function updateLifecycle(world: World): void {
  for (let i = world.bees.length - 1; i >= 0; i--) {
    const bee = world.bees[i];

    // Age
    bee.age++;

    // Energy drain based on activity, or recovery when resting at hive
    if (bee.path.length > 0) {
      bee.energy -= ENERGY_DRAIN_FLYING;
    } else if (WORKING_STATES.has(bee.state)) {
      bee.energy -= ENERGY_DRAIN_WORKING;
    } else if ((bee.state === BeeState.Resting || bee.state === BeeState.IdleAtHive) && bee.q === 0 && bee.r === 0) {
      // Recover energy while resting at hive
      bee.energy = Math.min(1, bee.energy + ENERGY_REST_RECOVER);
    } else {
      bee.energy -= ENERGY_DRAIN_IDLE;
    }

    bee.energy = Math.max(0, bee.energy);

    // Death check — only from old age, not energy
    if (bee.age >= bee.maxAge) {
      world.bees.splice(i, 1);
      world.deathCount++;
    }
  }
}
