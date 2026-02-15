import { BeeRole, BeeState } from '../types';
export function destroyBee(world, id) {
    const idx = world.bees.findIndex(b => b.id === id);
    if (idx >= 0)
        world.bees.splice(idx, 1);
}
export function allBees(world) {
    return world.bees;
}
export function beeCount(world) {
    return world.bees.length;
}
export function beesWithRole(world, role) {
    return world.bees.filter(b => b.role === role);
}
export function idleBees(world) {
    return world.bees.filter(b => b.state === BeeState.Idle || b.state === BeeState.IdleAtHive);
}
export function assignRoleFromRatios(world, bee) {
    const total = world.bees.length;
    if (total === 0)
        return;
    const foragerTarget = Math.round(world.settings.foragerRatio * total);
    const nurseTarget = Math.round(world.settings.nurseRatio * total);
    const currentForagers = world.bees.filter(b => b.role === BeeRole.Forager).length;
    const currentNurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
    if (currentForagers < foragerTarget) {
        bee.role = BeeRole.Forager;
    }
    else if (currentNurses < nurseTarget) {
        bee.role = BeeRole.Nurse;
    }
    else {
        bee.role = BeeRole.Builder;
    }
}
