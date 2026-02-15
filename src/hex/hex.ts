import { AxialCoord } from '../types';
import { HEX_SIZE } from '../constants';

// Flat-top hex geometry constants
const SQRT3 = Math.sqrt(3);

/** Convert axial hex coord to pixel center (flat-top) */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2 * q);
  const y = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r);
  return { x, y };
}

/** Convert pixel to fractional axial coords (flat-top) */
export function pixelToHex(px: number, py: number): AxialCoord {
  const q = (2 / 3 * px) / HEX_SIZE;
  const r = (-1 / 3 * px + SQRT3 / 3 * py) / HEX_SIZE;
  return hexRound(q, r);
}

/** Round fractional axial to nearest hex */
export function hexRound(q: number, r: number): AxialCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/** Six neighbor directions (flat-top axial) */
const DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Get the 6 neighbors of a hex */
export function hexNeighbors(q: number, r: number): AxialCoord[] {
  return DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

/** Hex distance (axial) */
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

/** Get all hexes in a ring at given radius */
export function hexRing(centerQ: number, centerR: number, radius: number): AxialCoord[] {
  if (radius === 0) return [{ q: centerQ, r: centerR }];
  const results: AxialCoord[] = [];
  let q = centerQ + DIRECTIONS[4].q * radius;
  let r = centerR + DIRECTIONS[4].r * radius;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q, r });
      q += DIRECTIONS[i].q;
      r += DIRECTIONS[i].r;
    }
  }
  return results;
}

/** Get all hexes within radius (filled disk) */
export function hexDisk(centerQ: number, centerR: number, radius: number): AxialCoord[] {
  const results: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      results.push({ q: centerQ + dq, r: centerR + dr });
    }
  }
  return results;
}

/** Get the 6 corner points of a hex in pixel coords (flat-top) */
export function hexCorners(cx: number, cy: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i);
    corners.push({
      x: cx + HEX_SIZE * Math.cos(angle),
      y: cy + HEX_SIZE * Math.sin(angle),
    });
  }
  return corners;
}

/** Hex key for map lookups */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}
