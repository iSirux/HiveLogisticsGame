import { updateBeeAI } from '../entities/beeAI';
export function updateForaging(world) {
    for (const bee of world.bees) {
        updateBeeAI(bee, world);
    }
}
