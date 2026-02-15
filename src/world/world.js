import { HexGrid } from '../hex/hexGrid';
import { InputMode, TerrainType } from '../types';
export class World {
    constructor() {
        this.grid = new HexGrid();
        this.bees = [];
        this.nextEntityId = 1;
        this.resources = { honey: 0, nectar: 0, wax: 0 };
        this.settings = {
            foragerRatio: 0.6,
            nurseRatio: 0.25,
            speedMultiplier: 1,
            paused: false,
        };
        this.inputState = {
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
        this.dayProgress = 0.1; // 0-1 cycle, start at morning
        this.dayCount = 1;
        this.tickCount = 0;
        // Sound events queue (consumed by audio manager each frame)
        this.pendingSounds = [];
        // Brief notification message for the player
        this.notification = '';
        this.notificationTimer = 0;
    }
    /** Deduct honey from storage cells. Returns true if enough honey was available. */
    deductHoney(amount) {
        const storageCells = this.grid.cellsOfType(TerrainType.HoneyStorage);
        const total = storageCells.reduce((sum, c) => sum + c.honeyStored, 0);
        if (total < amount - 0.001)
            return false;
        let remaining = amount;
        for (const sc of storageCells) {
            if (remaining <= 0)
                break;
            const take = Math.min(sc.honeyStored, remaining);
            sc.honeyStored -= take;
            remaining -= take;
        }
        return true;
    }
}
