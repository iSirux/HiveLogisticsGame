import { World } from '../world/world';
import { hexToPixel } from '../hex/hex';
import { BEE_SPEED } from '../constants';

export function updateMovement(world: World): void {
  for (const bee of world.bees) {
    // Save previous pixel position for interpolation
    bee.prevPixelX = bee.pixelX;
    bee.prevPixelY = bee.pixelY;

    // Update wing animation
    bee.wingPhase += 0.5;

    // Move along path using BEE_SPEED accumulator
    if (bee.path.length > 0) {
      bee.moveProgress += BEE_SPEED;
      while (bee.moveProgress >= 1 && bee.path.length > 0) {
        bee.moveProgress -= 1;
        const next = bee.path.shift()!;
        bee.q = next.q;
        bee.r = next.r;
      }
    }

    // Update pixel position — lerp toward next hex if mid-move
    const cur = hexToPixel(bee.q, bee.r);
    let px = cur.x;
    let py = cur.y;

    if (bee.path.length > 0 && bee.moveProgress > 0) {
      const next = hexToPixel(bee.path[0].q, bee.path[0].r);
      const t = bee.moveProgress;
      px = cur.x + (next.x - cur.x) * t;
      py = cur.y + (next.y - cur.y) * t;
    }

    // Add small jitter per bee id so they don't overlap exactly
    const jx = ((bee.id * 7) % 11 - 5) * 1.2;
    const jy = ((bee.id * 13) % 11 - 5) * 1.2;
    bee.pixelX = px + jx;
    bee.pixelY = py + jy;
  }
}
