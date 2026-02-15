// === Hex Geometry (flat-top) ===
export const HEX_SIZE = 28; // outer radius in pixels

// === Simulation ===
export const SIM_TPS = 10; // ticks per second
export const SIM_TICK_MS = 1000 / SIM_TPS;
export const MAX_TICKS_PER_FRAME = 3;

// === World Generation ===
export const CHUNK_SIZE = 16; // hexes per chunk side
export const INITIAL_NECTAR_MIN = 1 / 2;
export const INITIAL_NECTAR_MAX = 1;
export const INITIAL_POLLEN_MIN = 2 / 5;
export const INITIAL_POLLEN_MAX = 4 / 5;

// === Biome Thresholds ===
export const BIOME_MEADOW_RADIUS = 12;
export const BIOME_FOREST_RADIUS = 22;

// === Bees ===
export const STARTING_FORAGERS = 4;
export const STARTING_NURSES = 1;
export const STARTING_SCOUTS = 1;
export const STARTING_HAULERS = 1;
export const STARTING_BUILDERS = 1;
export const BEE_SPEED = 1 / 2; // progress per tick (1.0 = advance one hex)
export const HARVEST_TICKS = 55; // ticks to harvest a flower
export const DEPOSIT_TICKS = 5; // ticks to deposit nectar
export const NECTAR_PER_HARVEST = 3 / 20; // nectar taken per harvest
export const POLLEN_PER_HARVEST = 2 / 25; // pollen taken per harvest
export const BEE_CARRY_CAPACITY = 3 / 20;
export const TEND_TICKS = 10; // ticks to tend brood
export const PROCESS_TICKS = 5; // ticks for nurse to process nectar

// === Hive Processing ===
export const NECTAR_TO_HONEY_RATIO = 5 / 5;
export const PROCESSING_RATE = 1 / 150; // nectar consumed per tick when processing
export const HONEY_STORAGE_CAPACITY = 5;
export const NECTAR_STORAGE_CAPACITY = 3;
export const POLLEN_STORAGE_CAPACITY = 4;
export const NECTAR_CELL_CAPACITY = 4;
export const BROOD_HONEY_COST = 2; // honey to start a brood
export const BROOD_BEE_BREAD_COST = 1; // bee bread to start a brood
export const BROOD_HATCH_THRESHOLD = 1;
export const BROOD_TEND_AMOUNT = 1 / 10; // progress per tend action
export const WAX_PER_TICK = 1 / 500; // passive wax from honey

// === Pollen → Bee Bread ===
export const POLLEN_TO_BEE_BREAD_RATE = 1 / 100; // per tick, passive in pollen storage
export const POLLEN_TO_BEE_BREAD_RATIO = 4 / 5;

// === Wax Works ===
export const WAX_WORKS_HONEY_CAPACITY = 2;
export const WAX_WORKS_PASSIVE_RATE = 1 / 200;
export const WAX_WORKS_BUILDER_RATE = 1 / 300;
export const WAX_WORKS_HONEY_TO_WAX_RATIO = 1 / 3;
export const BUILDER_WAX_WORK_TICKS = 20;

// === Building Costs ===
export const BUILD_COSTS: Record<string, { wax: number; honey: number }> = {
  honey_storage: { wax: 10, honey: 0 },
  processing: { wax: 8, honey: 0 },
  brood: { wax: 12, honey: 5 },
  pollen_storage: { wax: 8, honey: 0 },
  waystation: { wax: 6, honey: 0 },
  wax_works: { wax: 0, honey: 3 },
  nectar_storage: { wax: 8, honey: 0 },
};

// === Bee Energy ===
export const ENERGY_DRAIN_FLYING = 1 / 2500;
export const ENERGY_DRAIN_WORKING = 1 / 2500;
export const ENERGY_DRAIN_IDLE = 1 / 10000;
export const ENERGY_HUNGER_THRESHOLD = 25 / 100;
export const ENERGY_RESTORE_PER_TICK = 3 / 25;
export const HONEY_PER_EAT_TICK = 1 / 100;
export const EAT_TICKS = 8;

// === Bee Lifespan ===
export const BEE_MEAN_LIFESPAN = 60000;
export const BEE_LIFESPAN_VARIANCE = 15000;

// === Waystation ===
export const WAYSTATION_NECTAR_CAPACITY = 1;
export const WAYSTATION_POLLEN_CAPACITY = 1;
export const WAYSTATION_OVERFLOW_RATE = 1 / 25; // resources pushed to adjacent storage per tick

// === Hauler ===
export const HAULER_CARRY_CAPACITY = 5 / 5;
export const HAULER_PICKUP_TICKS = 5;

// === Day/Night ===
export const DAY_CYCLE_TICKS = 500; // ~50s at 10 tps
export const NIGHT_START = 7 / 10; // 70% = dusk
export const DAWN_END = 1 / 20; // 5% = dawn

// === Flower Regrowth ===
export const FLOWER_REGROWTH_RATE = 1 / 1000; // nectar per tick
export const FLOWER_POLLEN_REGROWTH_RATE = 3 / 5000; // pollen per tick

// === Flower Type Config ===
import { FlowerType } from "./types";

export interface FlowerTypeConfig {
  nectarMin: number;
  nectarMax: number;
  pollenMin: number;
  pollenMax: number;
  regrowthNectar: number;
  regrowthPollen: number;
  clusterMin: number;
  clusterMax: number;
  harvestTicks: number;
  color: string;
}

export const FLOWER_TYPE_CONFIG: Record<FlowerType, FlowerTypeConfig> = {
  [FlowerType.Clover]: {
    nectarMin: 0.4,
    nectarMax: 0.7,
    pollenMin: 0.1,
    pollenMax: 0.3,
    regrowthNectar: 1 / 700,
    regrowthPollen: 1 / 1200,
    clusterMin: 5,
    clusterMax: 7,
    harvestTicks: 50,
    color: "#e8f0e0",
  }, // white clover (cream-white with green tint)
  [FlowerType.Wildflower]: {
    nectarMin: 0.2,
    nectarMax: 0.5,
    pollenMin: 0.6,
    pollenMax: 1.0,
    regrowthNectar: 1 / 1000,
    regrowthPollen: 1 / 1600,
    clusterMin: 3,
    clusterMax: 5,
    harvestTicks: 55,
    color: "#8a5ec0",
  }, // violet-purple
  [FlowerType.Sunflower]: {
    nectarMin: 0.8,
    nectarMax: 1.2,
    pollenMin: 0.6,
    pollenMax: 1.0,
    regrowthNectar: 1 / 2000,
    regrowthPollen: 1 / 3200,
    clusterMin: 1,
    clusterMax: 2,
    harvestTicks: 65,
    color: "#ffc830",
  }, // bright warm yellow
  [FlowerType.Bluebell]: {
    nectarMin: 0.4,
    nectarMax: 0.8,
    pollenMin: 0.1,
    pollenMax: 0.3,
    regrowthNectar: 1 / 1000,
    regrowthPollen: 1 / 1600,
    clusterMin: 6,
    clusterMax: 7,
    harvestTicks: 55,
    color: "#6a64c8",
  }, // violet-blue
  [FlowerType.Honeysuckle]: {
    nectarMin: 1.0,
    nectarMax: 1.5,
    pollenMin: 0,
    pollenMax: 0,
    regrowthNectar: 1 / 2500,
    regrowthPollen: 0,
    clusterMin: 1,
    clusterMax: 1,
    harvestTicks: 70,
    color: "#f5dfa0",
  }, // cream/pale yellow
};

// === Camera ===
export const CAMERA_ZOOM_MIN = 3 / 10;
export const CAMERA_ZOOM_MAX = 3;
export const CAMERA_ZOOM_SPEED = 1 / 10;
export const CAMERA_PAN_SPEED = 500; // world-units per second for arrow/WASD pan

// === Minimap ===
export const MINIMAP_WIDTH = 180;
export const MINIMAP_HEIGHT = 200;

// === Rendering ===
export const BEE_BODY_RADIUS = 5;
export const BEE_DOT_ZOOM_THRESHOLD = 3 / 5; // below this zoom, draw bees as dots

// === Forager Scoring ===
export const SCORE_DISTANCE_WEIGHT = -1;
export const SCORE_NECTAR_WEIGHT = 3;
export const SCORE_POLLEN_WEIGHT = 2;
export const SCORE_JITTER = 2;
export const SCORE_WAYSTATION_WEIGHT = 3;
export const SCORE_WAYSTATION_MAX_DIST = 10;

// === Scout ===
export const SCOUT_VISION_RADIUS = 3;
export const SCOUT_EXPLORE_RANGE = 20;
export const SCOUT_WAYSTATION_EXPLORE_RANGE = 15;
export const WAGGLE_DANCE_TICKS = 30;
export const WAGGLE_DANCE_REVEAL_RADIUS = 4;
