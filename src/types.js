// === Terrain / Cell Types ===
export var TerrainType;
(function (TerrainType) {
    TerrainType["Grass"] = "grass";
    TerrainType["Flower"] = "flower";
    TerrainType["HiveEntrance"] = "hive_entrance";
    TerrainType["HoneyStorage"] = "honey_storage";
    TerrainType["Processing"] = "processing";
    TerrainType["Brood"] = "brood";
    TerrainType["Empty"] = "empty";
})(TerrainType || (TerrainType = {}));
// === Bee ===
export var BeeRole;
(function (BeeRole) {
    BeeRole["Forager"] = "forager";
    BeeRole["Nurse"] = "nurse";
    BeeRole["Builder"] = "builder";
})(BeeRole || (BeeRole = {}));
export var BeeState;
(function (BeeState) {
    BeeState["Idle"] = "idle";
    BeeState["FlyingToFlower"] = "flying_to_flower";
    BeeState["Harvesting"] = "harvesting";
    BeeState["ReturningToHive"] = "returning_to_hive";
    BeeState["Depositing"] = "depositing";
    BeeState["Resting"] = "resting";
    // Nurse states
    BeeState["FlyingToBrood"] = "flying_to_brood";
    BeeState["Tending"] = "tending";
    BeeState["FlyingToProcessing"] = "flying_to_processing";
    BeeState["Processing"] = "processing";
    // Builder
    BeeState["IdleAtHive"] = "idle_at_hive";
})(BeeState || (BeeState = {}));
// === Input ===
export var InputMode;
(function (InputMode) {
    InputMode["Select"] = "select";
    InputMode["Build"] = "build";
    InputMode["Pheromone"] = "pheromone";
})(InputMode || (InputMode = {}));
