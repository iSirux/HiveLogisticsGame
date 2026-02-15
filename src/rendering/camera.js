import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, CAMERA_ZOOM_SPEED } from '../constants';
export class Camera {
    constructor() {
        this.x = 0; // world-space center X
        this.y = 0; // world-space center Y
        this.zoom = 1.0;
        this.width = 800;
        this.height = 600;
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
    }
    /** Apply camera transform to canvas context */
    applyTransform(ctx) {
        ctx.setTransform(this.zoom, 0, 0, this.zoom, this.width / 2 - this.x * this.zoom, this.height / 2 - this.y * this.zoom);
    }
    /** Convert screen coords to world coords */
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.width / 2) / this.zoom + this.x,
            y: (sy - this.height / 2) / this.zoom + this.y,
        };
    }
    /** Convert world coords to screen coords */
    worldToScreen(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom + this.width / 2,
            y: (wy - this.y) * this.zoom + this.height / 2,
        };
    }
    /** Pan by screen-space delta */
    pan(dx, dy) {
        this.x -= dx / this.zoom;
        this.y -= dy / this.zoom;
    }
    /** Zoom at a screen-space point */
    zoomAt(sx, sy, delta) {
        const worldBefore = this.screenToWorld(sx, sy);
        const factor = delta > 0 ? (1 - CAMERA_ZOOM_SPEED) : (1 + CAMERA_ZOOM_SPEED);
        this.zoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, this.zoom * factor));
        const worldAfter = this.screenToWorld(sx, sy);
        this.x += worldBefore.x - worldAfter.x;
        this.y += worldBefore.y - worldAfter.y;
    }
    /** Check if a world-space point is within the visible viewport (with margin) */
    isVisible(wx, wy, margin = 50) {
        const halfW = this.width / 2 / this.zoom + margin;
        const halfH = this.height / 2 / this.zoom + margin;
        return Math.abs(wx - this.x) < halfW && Math.abs(wy - this.y) < halfH;
    }
}
