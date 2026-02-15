import { hexToPixel } from '../hex/hex';
export function updateMovement(world) {
    for (const bee of world.bees) {
        // Save previous pixel position for interpolation
        bee.prevPixelX = bee.pixelX;
        bee.prevPixelY = bee.pixelY;
        // Update wing animation
        bee.wingPhase += 0.5;
        // Move along path
        if (bee.path.length > 0) {
            const next = bee.path.shift();
            bee.q = next.q;
            bee.r = next.r;
        }
        // Update pixel position to current hex
        const { x, y } = hexToPixel(bee.q, bee.r);
        // Add small jitter per bee id so they don't overlap exactly
        const jx = ((bee.id * 7) % 11 - 5) * 1.2;
        const jy = ((bee.id * 13) % 11 - 5) * 1.2;
        bee.pixelX = x + jx;
        bee.pixelY = y + jy;
    }
}
