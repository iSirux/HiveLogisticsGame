import { BeeEntity, BeeRole, BeeState } from '../types';
import { World } from '../world/world';

export function destroyBee(world: World, id: number): void {
  const idx = world.bees.findIndex(b => b.id === id);
  if (idx >= 0) world.bees.splice(idx, 1);
}

export function allBees(world: World): BeeEntity[] {
  return world.bees;
}

export function beeCount(world: World): number {
  return world.bees.length;
}

export function beesWithRole(world: World, role: BeeRole): BeeEntity[] {
  return world.bees.filter(b => b.role === role);
}

export function idleBees(world: World): BeeEntity[] {
  return world.bees.filter(b => b.state === BeeState.Idle || b.state === BeeState.IdleAtHive);
}

export function assignRoleFromRatios(world: World, bee: BeeEntity): void {
  const total = world.bees.length;
  if (total === 0) return;

  const foragerTarget = Math.max(1, Math.round(world.settings.foragerRatio * total));
  const nurseTarget = Math.max(1, Math.round(world.settings.nurseRatio * total));
  const scoutTarget = Math.max(1, Math.round(world.settings.scoutRatio * total));
  const haulerTarget = Math.max(1, Math.round(world.settings.haulerRatio * total));

  const currentForagers = world.bees.filter(b => b.role === BeeRole.Forager).length;
  const currentNurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
  const currentScouts = world.bees.filter(b => b.role === BeeRole.Scout).length;
  const currentHaulers = world.bees.filter(b => b.role === BeeRole.Hauler).length;

  if (currentForagers < foragerTarget) {
    bee.role = BeeRole.Forager;
  } else if (currentNurses < nurseTarget) {
    bee.role = BeeRole.Nurse;
  } else if (currentScouts < scoutTarget) {
    bee.role = BeeRole.Scout;
  } else if (currentHaulers < haulerTarget) {
    bee.role = BeeRole.Hauler;
  } else {
    bee.role = BeeRole.Builder;
  }
}
