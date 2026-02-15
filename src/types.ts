// === Hex Coordinates ===
export interface AxialCoord {
  q: number;
  r: number;
}

// === Terrain / Cell Types ===
export enum TerrainType {
  Grass = 'grass',
  Flower = 'flower',
  HiveEntrance = 'hive_entrance',
  HoneyStorage = 'honey_storage',
  Processing = 'processing',
  Brood = 'brood',
  Empty = 'empty',
}

export interface HexCell {
  q: number;
  r: number;
  terrain: TerrainType;
  // Flower fields
  nectarAmount: number;    // 0-1 current nectar
  nectarMax: number;       // max nectar capacity
  flowerColor: string;     // petal color
  // Hive cell fields
  honeyStored: number;
  nectarStored: number;
  processingProgress: number; // 0-1
  broodProgress: number;     // 0-1, hatches at 1
  broodActive: boolean;
  // Pheromone
  pheromone: number;       // 0-1
}

// === Bee ===
export enum BeeRole {
  Forager = 'forager',
  Nurse = 'nurse',
  Builder = 'builder',
}

export enum BeeState {
  Idle = 'idle',
  FlyingToFlower = 'flying_to_flower',
  Harvesting = 'harvesting',
  ReturningToHive = 'returning_to_hive',
  Depositing = 'depositing',
  Resting = 'resting',
  // Nurse states
  FlyingToBrood = 'flying_to_brood',
  Tending = 'tending',
  FlyingToProcessing = 'flying_to_processing',
  Processing = 'processing',
  // Builder
  IdleAtHive = 'idle_at_hive',
}

export interface BeeEntity {
  id: number;
  role: BeeRole;
  state: BeeState;
  // Position
  q: number;
  r: number;
  // Pixel position for smooth rendering
  pixelX: number;
  pixelY: number;
  prevPixelX: number;
  prevPixelY: number;
  // Movement
  path: AxialCoord[];
  // Foraging
  carryingNectar: number;
  targetQ: number;
  targetR: number;
  // Timers
  stateTimer: number; // ticks remaining in current state action
  // Visual
  wingPhase: number;
}

// === Input ===
export enum InputMode {
  Select = 'select',
  Build = 'build',
  Pheromone = 'pheromone',
}

export type BuildType = 'honey_storage' | 'processing' | 'brood';

export interface InputState {
  mode: InputMode;
  buildType: BuildType;
  hoveredHex: AxialCoord | null;
  selectedHex: AxialCoord | null;
  isPanning: boolean;
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

// === World Resources ===
export interface Resources {
  honey: number;
  nectar: number;
  wax: number;
}

// === World Settings ===
export interface WorldSettings {
  foragerRatio: number;  // 0-1
  nurseRatio: number;    // 0-1
  // builder = 1 - forager - nurse
  speedMultiplier: number; // 0, 1, 2, 3
  paused: boolean;
}
