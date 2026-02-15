import { HexGrid } from '../hex/hexGrid';
import { BeeEntity, InputState, InputMode, Resources, WorldSettings } from '../types';

export class World {
  grid: HexGrid = new HexGrid();
  bees: BeeEntity[] = [];
  nextEntityId = 1;
  resources: Resources = { honey: 0, nectar: 0, wax: 0 };
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
}
