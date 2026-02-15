import { pixelToHex } from '../hex/hex';
import { InputMode, TerrainType } from '../types';
import { BUILD_COSTS, PHEROMONE_PAINT_AMOUNT, PHEROMONE_MAX } from '../constants';
import { hexKey } from '../hex/hex';
export class InputHandler {
    constructor(canvas, camera) {
        this.onFirstClick = null;
        this.firstClickFired = false;
        this.camera = camera;
        this.canvas = canvas;
        this.bindEvents();
    }
    setWorld(world) {
        this.world = world;
    }
    setValidBuildHexesGetter(fn) {
        this.getValidBuildHexes = fn;
    }
    setFirstClickCallback(fn) {
        this.onFirstClick = fn;
    }
    getDpr() {
        return window.devicePixelRatio || 1;
    }
    bindEvents() {
        const c = this.canvas;
        c.addEventListener('mousemove', (e) => this.onMouseMove(e));
        c.addEventListener('mousedown', (e) => this.onMouseDown(e));
        c.addEventListener('mouseup', (e) => this.onMouseUp(e));
        c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        c.addEventListener('mouseleave', () => this.onMouseLeave());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }
    onMouseMove(e) {
        if (!this.world)
            return;
        const dpr = this.getDpr();
        const sx = e.offsetX * dpr;
        const sy = e.offsetY * dpr;
        const input = this.world.inputState;
        if (input.isPanning) {
            const dx = (e.offsetX - input.lastMouseX) * dpr;
            const dy = (e.offsetY - input.lastMouseY) * dpr;
            this.camera.pan(dx, dy);
        }
        input.lastMouseX = e.offsetX;
        input.lastMouseY = e.offsetY;
        // Update hovered hex
        const wp = this.camera.screenToWorld(sx, sy);
        const hex = pixelToHex(wp.x, wp.y);
        if (this.world.grid.has(hex.q, hex.r)) {
            input.hoveredHex = hex;
        }
        else {
            input.hoveredHex = null;
        }
        // Pheromone drag-painting
        if (input.isDragging && input.mode === InputMode.Pheromone && input.hoveredHex) {
            this.paintPheromone(input.hoveredHex.q, input.hoveredHex.r);
        }
    }
    onMouseDown(e) {
        if (!this.world)
            return;
        const input = this.world.inputState;
        if (!this.firstClickFired) {
            this.firstClickFired = true;
            this.onFirstClick?.();
        }
        if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
            // Right click or ctrl+click = pan
            input.isPanning = true;
            input.lastMouseX = e.offsetX;
            input.lastMouseY = e.offsetY;
            return;
        }
        if (e.button === 0) {
            input.isDragging = true;
            const hovered = input.hoveredHex;
            if (!hovered)
                return;
            if (input.mode === InputMode.Select) {
                input.selectedHex = { q: hovered.q, r: hovered.r };
            }
            else if (input.mode === InputMode.Build) {
                this.tryBuild(hovered.q, hovered.r);
            }
            else if (input.mode === InputMode.Pheromone) {
                this.paintPheromone(hovered.q, hovered.r);
            }
        }
    }
    onMouseUp(e) {
        if (!this.world)
            return;
        const input = this.world.inputState;
        if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
            input.isPanning = false;
        }
        if (e.button === 0) {
            input.isDragging = false;
        }
    }
    onMouseLeave() {
        if (!this.world)
            return;
        this.world.inputState.hoveredHex = null;
        this.world.inputState.isPanning = false;
        this.world.inputState.isDragging = false;
    }
    onWheel(e) {
        e.preventDefault();
        const dpr = this.getDpr();
        this.camera.zoomAt(e.offsetX * dpr, e.offsetY * dpr, e.deltaY);
    }
    onKeyDown(e) {
        if (!this.world)
            return;
        // Don't capture if user is interacting with input elements
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
            return;
        switch (e.key) {
            case 'Escape':
                this.setMode(InputMode.Select);
                break;
            case 'b':
            case 'B':
                this.setMode(InputMode.Build);
                break;
            case 'p':
            case 'P':
                this.setMode(InputMode.Pheromone);
                break;
        }
    }
    setMode(mode) {
        if (!this.world)
            return;
        this.world.inputState.mode = mode;
        // Update UI buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        // Toggle build panel
        const buildPanel = document.getElementById('build-panel');
        if (buildPanel) {
            buildPanel.classList.toggle('visible', mode === InputMode.Build);
        }
    }
    tryBuild(q, r) {
        const valid = this.getValidBuildHexes();
        const key = hexKey(q, r);
        if (!valid.has(key))
            return;
        const cell = this.world.grid.get(q, r);
        if (!cell)
            return;
        const buildType = this.world.inputState.buildType;
        const cost = BUILD_COSTS[buildType];
        if (!cost)
            return;
        // Check resources and show feedback if insufficient
        if (this.world.resources.wax < cost.wax) {
            this.world.notification = `Need ${cost.wax} wax (have ${this.world.resources.wax.toFixed(1)})`;
            this.world.notificationTimer = 2;
            return;
        }
        if (cost.honey > 0 && this.world.resources.honey < cost.honey) {
            this.world.notification = `Need ${cost.honey} honey (have ${this.world.resources.honey.toFixed(1)})`;
            this.world.notificationTimer = 2;
            return;
        }
        // Deduct wax from global pool (not cell-stored)
        this.world.resources.wax -= cost.wax;
        // Deduct honey from storage cells so hive system recalculation stays consistent
        if (cost.honey > 0) {
            this.world.deductHoney(cost.honey);
        }
        // Place cell
        const terrainMap = {
            honey_storage: TerrainType.HoneyStorage,
            processing: TerrainType.Processing,
            brood: TerrainType.Brood,
        };
        cell.terrain = terrainMap[buildType];
        cell.honeyStored = 0;
        cell.nectarStored = 0;
        cell.processingProgress = 0;
        cell.broodProgress = 0;
        cell.broodActive = false;
        // Trigger build sound
        this.world.pendingSounds.push('build');
    }
    paintPheromone(q, r) {
        const cell = this.world.grid.get(q, r);
        if (!cell)
            return;
        cell.pheromone = Math.min(PHEROMONE_MAX, cell.pheromone + PHEROMONE_PAINT_AMOUNT);
    }
}
