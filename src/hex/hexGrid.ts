import { HexCell, TerrainType } from '../types';
import { hexKey } from './hex';

export class HexGrid {
  cells: Map<string, HexCell> = new Map();

  get(q: number, r: number): HexCell | undefined {
    return this.cells.get(hexKey(q, r));
  }

  set(q: number, r: number, cell: HexCell): void {
    this.cells.set(hexKey(q, r), cell);
  }

  has(q: number, r: number): boolean {
    return this.cells.has(hexKey(q, r));
  }

  createCell(q: number, r: number, terrain: TerrainType): HexCell {
    const cell: HexCell = {
      q, r, terrain,
      nectarAmount: 0,
      nectarMax: 0,
      pollenAmount: 0,
      pollenMax: 0,
      flowerColor: '#ff69b4',
      resinAmount: 0,
      resinMax: 0,
      honeyStored: 0,
      nectarStored: 0,
      pollenStored: 0,
      processingProgress: 0,
      broodProgress: 0,
      broodActive: false,
      pheromone: 0,
      explored: false,
    };
    this.set(q, r, cell);
    return cell;
  }

  allCells(): HexCell[] {
    return Array.from(this.cells.values());
  }

  /** Get all cells matching a terrain type */
  cellsOfType(terrain: TerrainType): HexCell[] {
    return this.allCells().filter(c => c.terrain === terrain);
  }

  /** Get all hive cells (entrance + storage + processing + brood + pollen storage) */
  hiveCells(): HexCell[] {
    return this.allCells().filter(c =>
      c.terrain === TerrainType.HiveEntrance ||
      c.terrain === TerrainType.HoneyStorage ||
      c.terrain === TerrainType.PollenStorage ||
      c.terrain === TerrainType.Processing ||
      c.terrain === TerrainType.Brood
    );
  }
}
