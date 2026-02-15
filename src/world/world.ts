import { HexGrid } from '../hex/hexGrid';
import { BeeEntity, InputState, InputMode, Resources, WorldSettings, TerrainType } from '../types';

export class World {
  grid: HexGrid = new HexGrid();
  bees: BeeEntity[] = [];
  nextEntityId = 1;
  resources: Resources = { honey: 0, nectar: 0, wax: 10, pollen: 0, beeBread: 0 };
  settings: WorldSettings = {
    nurseCount: 1,
    scoutCount: 1,
    haulerCount: 0,
    builderCount: 1,
    speedMultiplier: 1,
    paused: false,
  };
  inputState: InputState = {
    mode: InputMode.Select,
    buildType: 'honey_storage',
    hoveredHex: null,
    selectedHex: null,
    isPanning: false,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  };

  // Day/night
  dayProgress = 0.1; // 0-1 cycle, start at morning
  dayCount = 1;
  tickCount = 0;

  // Version counters for minimap cache invalidation
  terrainVersion = 0;
  explorationVersion = 0;

  // Procedural generation
  worldSeed: number = Math.floor(Math.random() * 0x7FFFFFFF);
  loadedChunks: Set<string> = new Set();

  // World bounds (pixel coords of explored area, updated when chunks generate)
  worldBoundsMinX = -200;
  worldBoundsMaxX = 200;
  worldBoundsMinY = -200;
  worldBoundsMaxY = 200;

  // Debug flags
  debugFogDisabled = false;

  // Death tracking
  deathCount = 0;

  // Resource tracking: net change per day
  resourcesAtDayStart: Resources = { honey: 0, nectar: 0, wax: 0, pollen: 0, beeBread: 0 };
  resourceDeltaYesterday: Resources = { honey: 0, nectar: 0, wax: 0, pollen: 0, beeBread: 0 };

  // Sound events queue (consumed by audio manager each frame)
  pendingSounds: string[] = [];

  // Brief notification message for the player
  notification: string = '';
  notificationTimer: number = 0;

  /** Deduct honey from storage cells. Returns true if enough honey was available. */
  deductHoney(amount: number): boolean {
    const storageCells = this.grid.cellsOfType(TerrainType.HoneyStorage);
    const total = storageCells.reduce((sum, c) => sum + c.honeyStored, 0);
    if (total < amount - 0.001) return false;
    let remaining = amount;
    for (const sc of storageCells) {
      if (remaining <= 0) break;
      const take = Math.min(sc.honeyStored, remaining);
      sc.honeyStored -= take;
      remaining -= take;
    }
    return true;
  }

  /** Deduct bee bread from global resource. Returns true if enough was available. */
  deductBeeBread(amount: number): boolean {
    if (this.resources.beeBread < amount - 0.001) return false;
    this.resources.beeBread -= amount;
    return true;
  }
}
