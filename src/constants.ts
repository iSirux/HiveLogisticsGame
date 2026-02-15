// === Hex Geometry (flat-top) ===
export const HEX_SIZE = 28;  // outer radius in pixels

// === Simulation ===
export const SIM_TPS = 10;               // ticks per second
export const SIM_TICK_MS = 1000 / SIM_TPS;
export const MAX_TICKS_PER_FRAME = 3;

// === World Generation ===
export const WORLD_RADIUS = 15;          // hex radius of generated world
export const FLOWER_CLUSTER_COUNT = 6;
export const FLOWER_CLUSTER_RADIUS = 1;  // center + ring-1
export const FLOWER_MIN_DISTANCE = 4;    // min dist from origin for flower clusters
export const FLOWER_MAX_DISTANCE = 12;
export const INITIAL_NECTAR_MIN = 0.5;
export const INITIAL_NECTAR_MAX = 1.0;

// === Bees ===
export const STARTING_FORAGERS = 8;
export const STARTING_NURSES = 3;
export const STARTING_BUILDERS = 2;
export const BEE_SPEED = 1;              // hexes per tick
export const HARVEST_TICKS = 8;          // ticks to harvest a flower
export const DEPOSIT_TICKS = 3;          // ticks to deposit nectar
export const NECTAR_PER_HARVEST = 0.15;  // nectar taken per harvest
export const BEE_CARRY_CAPACITY = 0.15;
export const TEND_TICKS = 10;            // ticks to tend brood
export const PROCESS_TICKS = 5;          // ticks for nurse to process nectar

// === Hive Processing ===
export const NECTAR_TO_HONEY_RATIO = 0.5;
export const PROCESSING_RATE = 0.02;     // nectar consumed per tick when processing
export const HONEY_STORAGE_CAPACITY = 5;
export const NECTAR_STORAGE_CAPACITY = 3;
export const BROOD_HONEY_COST = 2;       // honey to start a brood
export const BROOD_HATCH_THRESHOLD = 1.0;
export const BROOD_TEND_AMOUNT = 0.1;    // progress per tend action
export const WAX_PER_TICK = 0.002;       // passive wax from honey

// === Building Costs ===
export const BUILD_COSTS: Record<string, { wax: number; honey: number }> = {
  honey_storage: { wax: 10, honey: 0 },
  processing:    { wax: 8,  honey: 0 },
  brood:         { wax: 12, honey: 5 },
};

// === Pheromones ===
export const PHEROMONE_PAINT_AMOUNT = 0.3;
export const PHEROMONE_MAX = 1.0;
export const PHEROMONE_DECAY_RATE = 0.001; // per tick

// === Day/Night ===
export const DAY_CYCLE_TICKS = 500;      // ~50s at 10 tps
export const NIGHT_START = 0.7;          // 70% = dusk
export const DAWN_END = 0.05;            // 5% = dawn

// === Flower Regrowth ===
export const FLOWER_REGROWTH_RATE = 0.0005; // nectar per tick

// === Camera ===
export const CAMERA_ZOOM_MIN = 0.3;
export const CAMERA_ZOOM_MAX = 3.0;
export const CAMERA_ZOOM_SPEED = 0.1;

// === Rendering ===
export const BEE_BODY_RADIUS = 5;
export const BEE_DOT_ZOOM_THRESHOLD = 0.6; // below this zoom, draw bees as dots

// === Forager Scoring ===
export const SCORE_DISTANCE_WEIGHT = -1;
export const SCORE_PHEROMONE_WEIGHT = 5;
export const SCORE_NECTAR_WEIGHT = 3;
export const SCORE_JITTER = 2;
