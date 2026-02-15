import { World } from '../world/world';
import { HexCell, BeeEntity } from '../types';
import { hexToPixel, hexKey } from '../hex/hex';

const SAVE_VERSION = 1;
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
    debugFogDisabled: boolean;
    cells: HexCell[];
    bees: SerializedBee[];
  };
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

export function serializeWorld(world: World, slotName: string): SaveData {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    slotName,
    world: {
      resources: { ...world.resources },
      settings: {
        foragerRatio: world.settings.foragerRatio,
        nurseRatio: world.settings.nurseRatio,
        scoutRatio: world.settings.scoutRatio,
        haulerRatio: world.settings.haulerRatio,
        speedMultiplier: world.settings.speedMultiplier,
        paused: world.settings.paused,
      },
      dayProgress: world.dayProgress,
      dayCount: world.dayCount,
      tickCount: world.tickCount,
      nextEntityId: world.nextEntityId,
      deathCount: world.deathCount,
      debugFogDisabled: world.debugFogDisabled,
      cells: world.grid.allCells(),
      bees: world.bees.map(serializeBee),
    },
  };
}

export function restoreWorld(world: World, data: SaveData): void {
  const w = data.world;

  // Restore scalar state
  world.resources = { ...w.resources };
  world.settings.foragerRatio = w.settings.foragerRatio;
  world.settings.nurseRatio = w.settings.nurseRatio;
  world.settings.scoutRatio = w.settings.scoutRatio;
  world.settings.haulerRatio = w.settings.haulerRatio;
  world.settings.speedMultiplier = w.settings.speedMultiplier;
  world.settings.paused = w.settings.paused;
  world.dayProgress = w.dayProgress;
  world.dayCount = w.dayCount;
  world.tickCount = w.tickCount;
  world.nextEntityId = w.nextEntityId;
  world.deathCount = w.deathCount;
  world.debugFogDisabled = w.debugFogDisabled;

  // Rebuild hex grid
  world.grid.cells.clear();
  for (const cell of w.cells) {
    world.grid.cells.set(hexKey(cell.q, cell.r), cell);
  }

  // Rebuild bees with pixel positions
  world.bees = w.bees.map(deserializeBee);

  // Bump version counters so minimap redraws
  world.terrainVersion++;
  world.explorationVersion++;
}

export function saveToSlot(world: World, slotName: string): void {
  const data = serializeWorld(world, slotName);
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
