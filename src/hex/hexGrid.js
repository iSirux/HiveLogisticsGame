import { TerrainType } from '../types';
import { hexKey } from './hex';
export class HexGrid {
    constructor() {
        this.cells = new Map();
    }
    get(q, r) {
        return this.cells.get(hexKey(q, r));
    }
    set(q, r, cell) {
        this.cells.set(hexKey(q, r), cell);
    }
    has(q, r) {
        return this.cells.has(hexKey(q, r));
    }
    createCell(q, r, terrain) {
        const cell = {
            q, r, terrain,
            nectarAmount: 0,
            nectarMax: 0,
            flowerColor: '#ff69b4',
            honeyStored: 0,
            nectarStored: 0,
            processingProgress: 0,
            broodProgress: 0,
            broodActive: false,
            pheromone: 0,
        };
        this.set(q, r, cell);
        return cell;
    }
    allCells() {
        return Array.from(this.cells.values());
    }
    /** Get all cells matching a terrain type */
    cellsOfType(terrain) {
        return this.allCells().filter(c => c.terrain === terrain);
    }
    /** Get all hive cells (entrance + storage + processing + brood) */
    hiveCells() {
        return this.allCells().filter(c => c.terrain === TerrainType.HiveEntrance ||
            c.terrain === TerrainType.HoneyStorage ||
            c.terrain === TerrainType.Processing ||
            c.terrain === TerrainType.Brood);
    }
}
