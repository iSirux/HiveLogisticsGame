// Entity types are defined in types.ts
// This file re-exports for convenience and contains entity helper utilities

import { BeeEntity, BeeRole, BeeState, TerrainType } from '../types';
import { World } from '../world/world';

/** Check if a hex is a hive cell */
export function isHiveCell(terrain: TerrainType): boolean {
  return terrain === TerrainType.HiveEntrance
    || terrain === TerrainType.HoneyStorage
    || terrain === TerrainType.Processing
    || terrain === TerrainType.Brood;
}

/** Get all bees at a specific hex */
export function beesAtHex(world: World, q: number, r: number): BeeEntity[] {
  return world.bees.filter(b => b.q === q && b.r === r);
}

/** Get all bees with a specific role */
export function beesByRole(world: World, role: BeeRole): BeeEntity[] {
  return world.bees.filter(b => b.role === role);
}

/** Get all bees in a specific state */
export function beesByState(world: World, state: BeeState): BeeEntity[] {
  return world.bees.filter(b => b.state === state);
}
