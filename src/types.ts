// === Hex Coordinates ===
export interface AxialCoord {
  q: number;
  r: number;
}

// === Flower Types ===
export enum FlowerType {
  Clover = 'clover',
  Wildflower = 'wildflower',
  Sunflower = 'sunflower',
  Bluebell = 'bluebell',
  Honeysuckle = 'honeysuckle',
}

// === Biomes ===
export type Biome = 'meadow' | 'forest' | 'wetland' | 'wilds';

// === Terrain / Cell Types ===
export enum TerrainType {
  Grass = 'grass',
  Flower = 'flower',
  Tree = 'tree',
  Water = 'water',
  HiveEntrance = 'hive_entrance',
  HoneyStorage = 'honey_storage',
  PollenStorage = 'pollen_storage',
  Processing = 'processing',
  Brood = 'brood',
  Empty = 'empty',
  Waystation = 'waystation',
  WaxWorks = 'wax_works',
  NectarStorage = 'nectar_storage',
}

export interface HexCell {
  q: number;
  r: number;
  terrain: TerrainType;
  // Flower fields
  nectarAmount: number;    // 0-1 current nectar
  nectarMax: number;       // max nectar capacity
  pollenAmount: number;    // 0-1 current pollen
  pollenMax: number;       // max pollen capacity
  flowerColor: string;     // petal color
  flowerType: FlowerType;  // species (only meaningful for Flower terrain)
  // Tree fields
  resinAmount: number;
  resinMax: number;
  // Hive cell fields
  honeyStored: number;
  nectarStored: number;
  pollenStored: number;    // pollen in pollen storage cells
  processingProgress: number; // 0-1
  broodProgress: number;     // 0-1, hatches at 1
  broodActive: boolean;
  // Biome
  biome: Biome;
  // Fog of war
  explored: boolean;
}

// === Bee ===
export enum BeeRole {
  Forager = 'forager',
  Nurse = 'nurse',
  Scout = 'scout',
  Hauler = 'hauler',
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
  // Energy states
  Hungry = 'hungry',
  Eating = 'eating',
  // Hauler states
  FlyingToWaystation = 'flying_to_waystation',
  PickingUp = 'picking_up',
  // Builder wax works states
  FlyingToWaxWorks = 'flying_to_wax_works',
  ProducingWax = 'producing_wax',
  // Scout states
  FlyingToExplore = 'flying_to_explore',
  Exploring = 'exploring',
  WaggleDancing = 'waggle_dancing',
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
  moveProgress: number; // 0-1, advances by BEE_SPEED per tick
  // Carrying resources
  carrying: { nectar: number; pollen: number };
  targetQ: number;
  targetR: number;
  // Scout fields
  explorationTarget: AxialCoord | null;
  danceTicks: number;
  baseQ: number;
  baseR: number;
  // Timers
  stateTimer: number; // ticks remaining in current state action
  // Energy & lifespan
  energy: number;    // 0-1
  age: number;       // ticks lived
  maxAge: number;    // ticks until death
  // Visual
  wingPhase: number;
}

// === Input ===
export enum InputMode {
  Select = 'select',
  Build = 'build',
}

export type BuildType = 'honey_storage' | 'processing' | 'brood' | 'pollen_storage' | 'waystation' | 'wax_works' | 'nectar_storage';

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
  pollen: number;
  beeBread: number;
}

// === World Settings ===
export interface WorldSettings {
  nurseCount: number;    // flat count (min 1 enforced at reassignment)
  scoutCount: number;    // flat count (min 1 enforced at reassignment)
  haulerCount: number;   // flat count (min 0)
  builderCount: number;  // flat count (min 1 enforced at reassignment)
  // forager = all remaining bees
  speedMultiplier: number; // 0, 1, 2, 3
  paused: boolean;
}
