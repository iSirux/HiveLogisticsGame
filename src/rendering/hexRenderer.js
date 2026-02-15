import { TerrainType } from '../types';
import { hexToPixel, hexCorners } from '../hex/hex';
import { HEX_SIZE } from '../constants';
const TERRAIN_COLORS = {
    [TerrainType.Grass]: '#4a7c3f',
    [TerrainType.Flower]: '#6b9e5a',
    [TerrainType.HiveEntrance]: '#c8a040',
    [TerrainType.HoneyStorage]: '#d4a830',
    [TerrainType.Processing]: '#b89030',
    [TerrainType.Brood]: '#c49040',
    [TerrainType.Empty]: '#333333',
};
export function renderHexGrid(ctx, world, camera, hoveredHex, selectedHex, buildMode, validBuildHexes) {
    const grid = world.grid;
    for (const cell of grid.cells.values()) {
        const { x: px, y: py } = hexToPixel(cell.q, cell.r);
        if (!camera.isVisible(px, py))
            continue;
        drawHex(ctx, cell, px, py);
        // Pheromone overlay
        if (cell.pheromone > 0.01) {
            drawPheromoneOverlay(ctx, px, py, cell.pheromone);
        }
        // Flower petals
        if (cell.terrain === TerrainType.Flower && cell.nectarAmount > 0) {
            drawFlower(ctx, px, py, cell);
        }
        // Hive cell content indicators
        if (cell.terrain === TerrainType.HoneyStorage && cell.honeyStored > 0) {
            drawStorageIndicator(ctx, px, py, cell.honeyStored, '#f0c040');
        }
        if (cell.terrain === TerrainType.Processing && cell.nectarStored > 0) {
            drawStorageIndicator(ctx, px, py, cell.nectarStored, '#80d040');
        }
        if (cell.terrain === TerrainType.Brood && cell.broodActive) {
            drawBroodIndicator(ctx, px, py, cell.broodProgress);
        }
    }
    // Build mode: highlight valid hexes
    if (buildMode) {
        for (const key of validBuildHexes) {
            const [qs, rs] = key.split(',');
            const q = parseInt(qs);
            const r = parseInt(rs);
            const { x: px, y: py } = hexToPixel(q, r);
            if (!camera.isVisible(px, py))
                continue;
            drawHexOutline(ctx, px, py, 'rgba(100, 255, 100, 0.4)', 2);
        }
    }
    // Hover highlight
    if (hoveredHex) {
        const { x: hx, y: hy } = hexToPixel(hoveredHex.q, hoveredHex.r);
        drawHexOutline(ctx, hx, hy, 'rgba(255, 255, 255, 0.6)', 2);
    }
    // Selected highlight
    if (selectedHex) {
        const { x: sx, y: sy } = hexToPixel(selectedHex.q, selectedHex.r);
        drawHexOutline(ctx, sx, sy, 'rgba(255, 220, 80, 0.8)', 3);
    }
}
function drawHex(ctx, cell, cx, cy) {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = TERRAIN_COLORS[cell.terrain];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}
function drawHexOutline(ctx, cx, cy, color, width) {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}
function drawPheromoneOverlay(ctx, cx, cy, strength) {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 255, 80, ${strength * 0.35})`;
    ctx.fill();
}
function drawFlower(ctx, cx, cy, cell) {
    const petalCount = 5;
    const petalR = HEX_SIZE * 0.22;
    const centerR = HEX_SIZE * 0.12;
    const orbitR = HEX_SIZE * 0.3;
    // Nectar fading: lerp from color to grey
    const alpha = 0.4 + cell.nectarAmount / cell.nectarMax * 0.6;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < petalCount; i++) {
        const angle = (Math.PI * 2 / petalCount) * i;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.arc(px, py, petalR, 0, Math.PI * 2);
        ctx.fillStyle = cell.flowerColor;
        ctx.fill();
    }
    // Center
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.globalAlpha = 1;
}
function drawStorageIndicator(ctx, cx, cy, amount, color) {
    const barW = HEX_SIZE * 0.8;
    const barH = 4;
    const fillRatio = Math.min(amount / 5, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - barW / 2, cy + HEX_SIZE * 0.4, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(cx - barW / 2, cy + HEX_SIZE * 0.4, barW * fillRatio, barH);
}
function drawBroodIndicator(ctx, cx, cy, progress) {
    ctx.beginPath();
    ctx.arc(cx, cy, HEX_SIZE * 0.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = '#ffe080';
    ctx.lineWidth = 3;
    ctx.stroke();
}
