import { HexCell, TerrainType, FlowerType, Biome } from '../types';
import { hexKey, hexNeighbors } from './hex';

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
      flowerType: FlowerType.Clover,
      resinAmount: 0,
      resinMax: 0,
      honeyStored: 0,
      nectarStored: 0,
      pollenStored: 0,
      processingProgress: 0,
      broodProgress: 0,
      broodActive: false,
      biome: 'meadow' as Biome,
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

  /** Get all waystation cells */
  waystationCells(): HexCell[] {
    return this.allCells().filter(c => c.terrain === TerrainType.Waystation);
  }

  /** Get keys of NectarStorage/PollenStorage cells adjacent to any waystation */
  waystationAdjacentStorageKeys(): Set<string> {
    const keys = new Set<string>();
    for (const ws of this.waystationCells()) {
      for (const nb of hexNeighbors(ws.q, ws.r)) {
        const cell = this.get(nb.q, nb.r);
        if (cell && (cell.terrain === TerrainType.NectarStorage || cell.terrain === TerrainType.PollenStorage)) {
          keys.add(hexKey(cell.q, cell.r));
        }
      }
    }
    return keys;
  }

  /** Get all hive cells (entrance + storage + processing + brood + pollen storage) */
  hiveCells(): HexCell[] {
    return this.allCells().filter(c =>
      c.terrain === TerrainType.HiveEntrance ||
      c.terrain === TerrainType.HoneyStorage ||
      c.terrain === TerrainType.PollenStorage ||
      c.terrain === TerrainType.Processing ||
      c.terrain === TerrainType.Brood ||
      c.terrain === TerrainType.WaxWorks ||
      c.terrain === TerrainType.NectarStorage
    );
  }
}
