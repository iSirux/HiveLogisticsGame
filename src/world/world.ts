import { HexGrid } from '../hex/hexGrid';
import { BeeEntity, InputState, InputMode, Resources, WorldSettings, TerrainType } from '../types';

export class World {
  grid: HexGrid = new HexGrid();
  bees: BeeEntity[] = [];
  nextEntityId = 1;
  resources: Resources = { honey: 0, nectar: 0, wax: 10 };
  settings: WorldSettings = {
    foragerRatio: 0.6,
    nurseRatio: 0.25,
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
}
