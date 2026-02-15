import { World } from '../world/world';
import { HexCell, BeeEntity, TerrainType, FlowerType } from '../types';
import { hexToPixel, hexKey, hexDistance } from '../hex/hex';
import { Camera } from '../rendering/camera';
import { updateWorldBounds, getChunkCoord, chunkKey, getBiome } from '../world/procgen';
import { BIOME_MEADOW_RADIUS } from '../constants';

const SAVE_VERSION = 3;
const SAVE_PREFIX = 'hive_save_';

export interface SaveData {
  version: number;
  timestamp: number;
  slotName: string;
  world: {
    resources: World['resources'];
    settings: World['settings'];
    dayProgress: number;
    dayCount: number;
    tickCount: number;
    nextEntityId: number;
    deathCount: number;
    resourcesAtDayStart?: World['resources'];
    resourceDeltaYesterday?: World['resources'];
    debugFogDisabled: boolean;
    worldSeed: number;
    loadedChunks: string[];
    cells: HexCell[];
    bees: SerializedBee[];
  };
  camera?: { x: number; y: number; zoom: number };
}

/** Bee data without rendering-only pixel fields */
type SerializedBee = Omit<BeeEntity, 'pixelX' | 'pixelY' | 'prevPixelX' | 'prevPixelY'>;

function serializeBee(bee: BeeEntity): SerializedBee {
  const { pixelX, pixelY, prevPixelX, prevPixelY, ...rest } = bee;
  return rest;
}

function deserializeBee(data: SerializedBee): BeeEntity {
  const { x, y } = hexToPixel(data.q, data.r);
  return {
    ...data,
    pixelX: x,
    pixelY: y,
    prevPixelX: x,
    prevPixelY: y,
  };
}

export function serializeWorld(world: World, slotName: string, camera?: Camera): SaveData {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    slotName,
    camera: camera ? { x: camera.x, y: camera.y, zoom: camera.zoom } : undefined,
    world: {
      resources: { ...world.resources },
      settings: {
        nurseCount: world.settings.nurseCount,
        scoutCount: world.settings.scoutCount,
        haulerCount: world.settings.haulerCount,
        builderCount: world.settings.builderCount,
        speedMultiplier: world.settings.speedMultiplier,
        paused: world.settings.paused,
      },
      dayProgress: world.dayProgress,
      dayCount: world.dayCount,
      tickCount: world.tickCount,
      nextEntityId: world.nextEntityId,
      deathCount: world.deathCount,
      resourcesAtDayStart: { ...world.resourcesAtDayStart },
      resourceDeltaYesterday: { ...world.resourceDeltaYesterday },
      debugFogDisabled: world.debugFogDisabled,
      worldSeed: world.worldSeed,
      loadedChunks: Array.from(world.loadedChunks),
      cells: world.grid.allCells(),
      bees: world.bees.map(serializeBee),
    },
  };
}

export function restoreWorld(world: World, data: SaveData, camera?: Camera): void {
  const w = data.world;

  // Restore scalar state
  world.resources = { ...w.resources };

  // Migrate v1 saves (ratio-based) to v2 (count-based)
  const s = w.settings as any;
  if ('foragerRatio' in s) {
    const total = w.bees.length || 10;
    world.settings.nurseCount = Math.max(1, Math.round((s.nurseRatio ?? 0.25) * total));
    world.settings.scoutCount = Math.max(1, Math.round((s.scoutRatio ?? 0.1) * total));
    world.settings.haulerCount = Math.round((s.haulerRatio ?? 0) * total);
    world.settings.builderCount = Math.max(1, Math.round((1 - (s.foragerRatio ?? 0.55) - (s.nurseRatio ?? 0.25) - (s.scoutRatio ?? 0.1) - (s.haulerRatio ?? 0)) * total));
  } else {
    world.settings.nurseCount = s.nurseCount ?? 1;
    world.settings.scoutCount = s.scoutCount ?? 1;
    world.settings.haulerCount = s.haulerCount ?? 0;
    world.settings.builderCount = s.builderCount ?? 1;
  }
  world.settings.speedMultiplier = w.settings.speedMultiplier;
  world.settings.paused = w.settings.paused;
  world.dayProgress = w.dayProgress;
  world.dayCount = w.dayCount;
  world.tickCount = w.tickCount;
  world.nextEntityId = w.nextEntityId;
  world.deathCount = w.deathCount;
  if (w.resourcesAtDayStart) world.resourcesAtDayStart = { ...w.resourcesAtDayStart };
  if (w.resourceDeltaYesterday) world.resourceDeltaYesterday = { ...w.resourceDeltaYesterday };
  world.debugFogDisabled = w.debugFogDisabled;

  // Restore seed and chunks
  world.worldSeed = (w as any).worldSeed ?? Math.floor(Math.random() * 0x7FFFFFFF);
  world.loadedChunks = new Set((w as any).loadedChunks ?? []);

  // Rebuild hex grid
  world.grid.cells.clear();
  for (const cell of w.cells) {
    world.grid.cells.set(hexKey(cell.q, cell.r), cell);
  }

  // Migrate old saves without flowerType: assign based on distance from origin
  for (const cell of world.grid.cells.values()) {
    if (cell.terrain === TerrainType.Flower && !cell.flowerType) {
      const dist = hexDistance(0, 0, cell.q, cell.r);
      cell.flowerType = dist <= BIOME_MEADOW_RADIUS ? FlowerType.Clover : FlowerType.Bluebell;
    }
  }

  // Migrate old saves without biome: recompute from coordinates
  for (const cell of world.grid.cells.values()) {
    if (!cell.biome) {
      cell.biome = getBiome(cell.q, cell.r, world.worldSeed);
    }
  }

  // For old saves without loadedChunks, mark all existing cells' chunks as loaded
  if (!((w as any).loadedChunks)) {
    for (const cell of w.cells) {
      const { cq, cr } = getChunkCoord(cell.q, cell.r);
      world.loadedChunks.add(chunkKey(cq, cr));
    }
  }

  // Rebuild bees with pixel positions
  world.bees = w.bees.map(deserializeBee);

  // Recompute world bounds
  updateWorldBounds(world);

  // Restore camera position
  if (camera && data.camera) {
    camera.x = data.camera.x;
    camera.y = data.camera.y;
    camera.zoom = data.camera.zoom;
  }

  // Bump version counters so minimap redraws
  world.terrainVersion++;
  world.explorationVersion++;
}

export function saveToSlot(world: World, slotName: string, camera?: Camera): void {
  const data = serializeWorld(world, slotName, camera);
  try {
    localStorage.setItem(SAVE_PREFIX + slotName, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadFromSlot(slotName: string): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slotName);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function listSaves(): { slotName: string; timestamp: number }[] {
  const saves: { slotName: string; timestamp: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SAVE_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key)!) as SaveData;
      saves.push({ slotName: data.slotName, timestamp: data.timestamp });
    } catch {
      // skip corrupt entries
    }
  }
  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteSave(slotName: string): void {
  localStorage.removeItem(SAVE_PREFIX + slotName);
}

export function getLatestSave(): SaveData | null {
  const saves = listSaves();
  if (saves.length === 0) return null;
  return loadFromSlot(saves[0].slotName);
}
