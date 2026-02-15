import { BeeEntity, BeeRole, BeeState } from '../types';
import { Camera } from './camera';
import { BEE_BODY_RADIUS, BEE_DOT_ZOOM_THRESHOLD } from '../constants';

const ROLE_COLORS: Record<BeeRole, string> = {
  [BeeRole.Forager]: '#f0c830',
  [BeeRole.Nurse]:   '#e8e0d0',
  [BeeRole.Scout]:   '#60b0e8',
  [BeeRole.Builder]: '#d0a050',
};

export function renderEntities(
  ctx: CanvasRenderingContext2D,
  bees: BeeEntity[],
  camera: Camera,
  tickAlpha: number,
) {
  for (const bee of bees) {
    // Interpolate position
    const px = bee.prevPixelX + (bee.pixelX - bee.prevPixelX) * tickAlpha;
    const py = bee.prevPixelY + (bee.pixelY - bee.prevPixelY) * tickAlpha;

    if (!camera.isVisible(px, py)) continue;

    if (camera.zoom < BEE_DOT_ZOOM_THRESHOLD) {
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

  // Waggle dance: pulsing circle
  if (bee.state === BeeState.WaggleDancing) {
    const pulse = 0.5 + Math.sin(bee.danceTicks * 0.5) * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, r * 4 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(96, 176, 232, ${0.3 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Wings (fluttering)
  const wingFlutter = Math.sin(bee.wingPhase) * 0.3;
  const wingSpread = 0.8 + wingFlutter;

  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(px - r * 0.6, py - r * wingSpread, r * 0.7, r * 0.4, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#d0e8ff';
  ctx.fill();
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

  // Carry indicators: green dot for nectar, yellow dot for pollen (side by side)
  const hasNectar = bee.carrying.nectar > 0;
  const hasPollen = bee.carrying.pollen > 0;
  if (hasNectar && hasPollen) {
    ctx.beginPath();
    ctx.arc(px - 2.5, py + r * 1.6, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#80d040';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 2.5, py + r * 1.6, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e0c020';
    ctx.fill();
  } else if (hasNectar) {
    ctx.beginPath();
    ctx.arc(px, py + r * 1.6, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#80d040';
    ctx.fill();
  } else if (hasPollen) {
    ctx.beginPath();
    ctx.arc(px, py + r * 1.6, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e0c020';
    ctx.fill();
  }
}
