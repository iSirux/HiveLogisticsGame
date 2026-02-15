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

export function assignRoleFromCounts(world: World, bee: BeeEntity): void {
  const total = world.bees.length;
  if (total === 0) return;

  const nurseTarget = Math.max(1, world.settings.nurseCount);
  const scoutTarget = Math.max(1, world.settings.scoutCount);
  const haulerTarget = world.settings.haulerCount;
  const builderTarget = Math.max(1, world.settings.builderCount);

  const currentNurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
  const currentScouts = world.bees.filter(b => b.role === BeeRole.Scout).length;
  const currentHaulers = world.bees.filter(b => b.role === BeeRole.Hauler).length;
  const currentBuilders = world.bees.filter(b => b.role === BeeRole.Builder).length;

  if (currentNurses < nurseTarget) {
    bee.role = BeeRole.Nurse;
  } else if (currentScouts < scoutTarget) {
    bee.role = BeeRole.Scout;
  } else if (currentHaulers < haulerTarget) {
    bee.role = BeeRole.Hauler;
  } else if (currentBuilders < builderTarget) {
    bee.role = BeeRole.Builder;
  } else {
    bee.role = BeeRole.Forager;
  }
}
