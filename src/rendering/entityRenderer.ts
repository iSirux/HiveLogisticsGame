import { BeeEntity, BeeRole } from '../types';
import { Camera } from './camera';
import { BEE_BODY_RADIUS, BEE_DOT_ZOOM_THRESHOLD } from '../constants';

const ROLE_COLORS: Record<BeeRole, string> = {
  [BeeRole.Forager]: '#f0c830',
  [BeeRole.Nurse]:   '#e8e0d0',
  [BeeRole.Builder]: '#d0a050',
};

export function renderEntities(
  ctx: CanvasRenderingContext2D,
  bees: BeeEntity[],
  camera: Camera,
  tickAlpha: number, // 0-1 interpolation between ticks
) {
  for (const bee of bees) {
    // Interpolate position
    const px = bee.prevPixelX + (bee.pixelX - bee.prevPixelX) * tickAlpha;
    const py = bee.prevPixelY + (bee.pixelY - bee.prevPixelY) * tickAlpha;

    if (!camera.isVisible(px, py)) continue;

    if (camera.zoom < BEE_DOT_ZOOM_THRESHOLD) {
      // Draw as dot when zoomed out
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = ROLE_COLORS[bee.role];
      ctx.fill();
      continue;
    }

    drawBee(ctx, bee, px, py);
  }
}

function drawBee(ctx: CanvasRenderingContext2D, bee: BeeEntity, px: number, py: number) {
  const r = BEE_BODY_RADIUS;
  const color = ROLE_COLORS[bee.role];

  // Wings (fluttering)
  const wingFlutter = Math.sin(bee.wingPhase) * 0.3;
  const wingSpread = 0.8 + wingFlutter;

  ctx.globalAlpha = 0.4;
  // Left wing
  ctx.beginPath();
  ctx.ellipse(px - r * 0.6, py - r * wingSpread, r * 0.7, r * 0.4, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#d0e8ff';
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.ellipse(px + r * 0.6, py - r * wingSpread, r * 0.7, r * 0.4, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#d0e8ff';
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body
  ctx.beginPath();
  ctx.ellipse(px, py, r * 1.3, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Stripes
  ctx.fillStyle = '#3a2a10';
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(px + i * r * 0.7 - 1, py - r * 0.8, 2, r * 1.6);
  }

  // Carry indicator (nectar drop)
  if (bee.carryingNectar > 0) {
    ctx.beginPath();
    ctx.arc(px, py + r * 1.6, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#80d040';
    ctx.fill();
  }
}
