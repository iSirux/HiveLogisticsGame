import { World } from '../world/world';
import { InputMode, BeeRole, TerrainType, BuildType, HexCell, BeeEntity, BeeState } from '../types';
import { InputHandler } from '../input/inputHandler';
import { NIGHT_START, DAWN_END, BUILD_COSTS, HONEY_STORAGE_CAPACITY, NECTAR_STORAGE_CAPACITY, POLLEN_STORAGE_CAPACITY, WAYSTATION_NECTAR_CAPACITY, WAYSTATION_POLLEN_CAPACITY } from '../constants';
import { hexToPixel } from '../hex/hex';
import { getLatestSave, restoreWorld } from '../storage/saveManager';

export class UIManager {
  private world!: World;
  private inputHandler!: InputHandler;
  private onSave?: () => void;
  private onNewGame?: () => void;

  // FPS tracking
  private frameCount = 0;
  private fpsLastTime = performance.now();
  private currentFps = 0;

  // Bees panel
  private beesFilterRole: string = 'all';

  init(world: World, inputHandler: InputHandler): void {
    this.world = world;
    this.inputHandler = inputHandler;
    this.bindModeButtons();
    this.bindBuildButtons();
    this.bindSpeedButtons();
    this.bindRoleSliders();
    this.bindRoleToggle();
    this.bindDebugPanel();
    this.bindBeesPanel();
  }

  private bindModeButtons(): void {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as InputMode;
        this.inputHandler.setMode(mode);
      });
    });
  }

  private bindBuildButtons(): void {
    document.querySelectorAll('.build-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const buildType = (btn as HTMLElement).dataset.build as BuildType;
        this.world.inputState.buildType = buildType;
        document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const sel = this.world.inputState.selectedHex;
        if (sel) {
          this.inputHandler.tryBuild(sel.q, sel.r);
        }
      });
    });
    const firstBtn = document.querySelector('.build-btn');
    firstBtn?.classList.add('active');
  }

  private bindSpeedButtons(): void {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt((btn as HTMLElement).dataset.speed || '1');
        this.world.settings.speedMultiplier = speed;
        this.world.settings.paused = speed === 0;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  private bindRoleSliders(): void {
    const foragerSlider = document.getElementById('slider-forager') as HTMLInputElement;
    const nurseSlider = document.getElementById('slider-nurse') as HTMLInputElement;
    const scoutSlider = document.getElementById('slider-scout') as HTMLInputElement;
    const haulerSlider = document.getElementById('slider-hauler') as HTMLInputElement;
    const foragerVal = document.getElementById('val-forager')!;
    const nurseVal = document.getElementById('val-nurse')!;
    const scoutVal = document.getElementById('val-scout')!;
    const haulerVal = document.getElementById('val-hauler')!;
    const builderVal = document.getElementById('val-builder')!;

    const update = () => {
      let fv = parseInt(foragerSlider.value);
      let nv = parseInt(nurseSlider.value);
      let sv = parseInt(scoutSlider.value);
      let hv = parseInt(haulerSlider.value);

      // Clamp so total <= 100
      if (fv + nv + sv + hv > 100) {
        hv = 100 - fv - nv - sv;
        if (hv < 0) {
          sv = 100 - fv - nv;
          hv = 0;
          if (sv < 0) {
            nv = 100 - fv;
            sv = 0;
            nurseSlider.value = nv.toString();
          }
          scoutSlider.value = sv.toString();
        }
        haulerSlider.value = hv.toString();
      }

      const bv = 100 - fv - nv - sv - hv;
      foragerVal.textContent = fv + '%';
      nurseVal.textContent = nv + '%';
      scoutVal.textContent = sv + '%';
      haulerVal.textContent = hv + '%';
      builderVal.textContent = bv + '%';

      this.world.settings.foragerRatio = fv / 100;
      this.world.settings.nurseRatio = nv / 100;
      this.world.settings.scoutRatio = sv / 100;
      this.world.settings.haulerRatio = hv / 100;

      this.reassignBees();
    };

    foragerSlider.addEventListener('input', update);
    nurseSlider.addEventListener('input', update);
    scoutSlider.addEventListener('input', update);
    haulerSlider.addEventListener('input', update);
  }

  private bindRoleToggle(): void {
    const btn = document.getElementById('role-toggle');
    const panel = document.getElementById('role-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      panel.classList.toggle('mobile-open');
    });
  }

  private bindDebugPanel(): void {
    const panel = document.getElementById('debug-panel');
    const tab = document.getElementById('debug-tab');
    const closeBtn = document.getElementById('debug-close');
    if (!panel || !tab) return;

    tab.addEventListener('click', () => {
      panel.classList.add('debug-open');
    });
    closeBtn?.addEventListener('click', () => {
      panel.classList.remove('debug-open');
    });

    // Fog toggle
    const fogToggle = document.getElementById('dbg-fog-toggle') as HTMLInputElement;
    if (fogToggle) {
      fogToggle.addEventListener('change', () => {
        this.world.debugFogDisabled = fogToggle.checked;
        // Force minimap to redraw by bumping exploration version
        this.world.explorationVersion++;
      });
    }

    // Add resources
    document.getElementById('dbg-add-resources')?.addEventListener('click', () => {
      this.world.resources.honey += 20;
      this.world.resources.wax += 20;
      this.world.resources.nectar += 10;
      this.world.resources.pollen += 10;
      this.world.resources.beeBread += 5;
      // Also fill honey storage cells
      const storageCells = this.world.grid.cellsOfType(TerrainType.HoneyStorage);
      let honeyToDistribute = 20;
      for (const cell of storageCells) {
        const space = HONEY_STORAGE_CAPACITY - cell.honeyStored;
        const add = Math.min(space, honeyToDistribute);
        cell.honeyStored += add;
        honeyToDistribute -= add;
        if (honeyToDistribute <= 0) break;
      }
    });

    // Spawn bees
    document.getElementById('dbg-spawn-bees')?.addEventListener('click', () => {
      const hiveCell = this.world.grid.cellsOfType(TerrainType.HiveEntrance)[0];
      if (!hiveCell) return;
      const { x, y } = hexToPixel(hiveCell.q, hiveCell.r);
      for (let i = 0; i < 5; i++) {
        this.world.bees.push({
          id: this.world.nextEntityId++,
          role: BeeRole.Forager,
          state: BeeState.Idle,
          q: hiveCell.q,
          r: hiveCell.r,
          pixelX: x,
          pixelY: y,
          prevPixelX: x,
          prevPixelY: y,
          path: [],
          moveProgress: 0,
          carrying: { nectar: 0, pollen: 0 },
          targetQ: 0,
          targetR: 0,
          explorationTarget: null,
          danceTicks: 0,
          baseQ: 0,
          baseR: 0,
          stateTimer: 0,
          energy: 1,
          age: 0,
          maxAge: 6000 + Math.floor(Math.random() * 3000 - 1500),
          wingPhase: Math.random() * Math.PI * 2,
        });
      }
    });

    // Skip to night
    document.getElementById('dbg-skip-night')?.addEventListener('click', () => {
      this.world.dayProgress = NIGHT_START;
    });

    // Skip to day
    document.getElementById('dbg-skip-day')?.addEventListener('click', () => {
      this.world.dayProgress = DAWN_END + 0.01;
      this.world.dayCount++;
    });

    // Save / Load / New Game
    document.getElementById('dbg-save')?.addEventListener('click', () => {
      this.onSave?.();
    });
    document.getElementById('dbg-load')?.addEventListener('click', () => {
      const save = getLatestSave();
      if (save) {
        restoreWorld(this.world, save);
        this.syncSlidersFromWorld();
      }
    });
    document.getElementById('dbg-new-game')?.addEventListener('click', () => {
      this.onNewGame?.();
    });
  }

  /** Let Game register callbacks without circular imports */
  setGameCallbacks(onSave: () => void, onNewGame: () => void): void {
    this.onSave = onSave;
    this.onNewGame = onNewGame;
  }

  /** Sync role sliders to match world settings (after load) */
  private syncSlidersFromWorld(): void {
    const set = (id: string, val: number) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = Math.round(val * 100).toString();
    };
    set('slider-forager', this.world.settings.foragerRatio);
    set('slider-nurse', this.world.settings.nurseRatio);
    set('slider-scout', this.world.settings.scoutRatio);
    set('slider-hauler', this.world.settings.haulerRatio);

    const setText = (id: string, val: number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.round(val * 100) + '%';
    };
    setText('val-forager', this.world.settings.foragerRatio);
    setText('val-nurse', this.world.settings.nurseRatio);
    setText('val-scout', this.world.settings.scoutRatio);
    setText('val-hauler', this.world.settings.haulerRatio);
    const builderPct = 1 - this.world.settings.foragerRatio - this.world.settings.nurseRatio - this.world.settings.scoutRatio - this.world.settings.haulerRatio;
    setText('val-builder', Math.max(0, builderPct));
  }

  private bindBeesPanel(): void {
    const panel = document.getElementById('bees-panel');
    const tab = document.getElementById('bees-tab');
    const closeBtn = document.getElementById('bees-close');
    if (!panel || !tab) return;

    tab.addEventListener('click', () => {
      panel.classList.add('bees-open');
    });
    closeBtn?.addEventListener('click', () => {
      panel.classList.remove('bees-open');
    });

    // Filter buttons
    document.querySelectorAll('.bees-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.beesFilterRole = (btn as HTMLElement).dataset.role || 'all';
        document.querySelectorAll('.bees-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  private updateBeesPanel(): void {
    const panel = document.getElementById('bees-panel');
    if (!panel || !panel.classList.contains('bees-open')) return;

    const bees = this.world.bees;
    const filtered = this.beesFilterRole === 'all'
      ? bees
      : bees.filter(b => b.role === this.beesFilterRole);

    // Summary
    const summary = document.getElementById('bees-summary');
    if (summary) {
      summary.textContent = `Showing ${filtered.length} of ${bees.length} bees`;
    }

    // Build list (cap at 100 for performance)
    const listEl = document.getElementById('bees-list');
    if (!listEl) return;

    const display = filtered.slice(0, 100);
    let html = '';
    for (const bee of display) {
      const state = bee.state.replace(/_/g, ' ');
      const energyPct = (bee.energy * 100).toFixed(0);
      let carry = '';
      if (bee.carrying.nectar > 0.01) carry += `n:${bee.carrying.nectar.toFixed(1)}`;
      if (bee.carrying.pollen > 0.01) carry += `${carry ? ' ' : ''}p:${bee.carrying.pollen.toFixed(1)}`;
      const carrySpan = carry ? ` <span style="color:#c8a03c">${carry}</span>` : '';
      html += `<div class="bee-row" data-bee-q="${bee.q}" data-bee-r="${bee.r}">`;
      html += `<span class="bee-id">#${bee.id}</span>`;
      html += `<span class="bee-role">${bee.role}</span>`;
      html += `<span class="bee-state">${state}${carrySpan}</span>`;
      html += `<span class="bee-energy">${energyPct}%</span>`;
      html += `</div>`;
    }
    if (filtered.length > 100) {
      html += `<div style="color:rgba(240,230,211,0.5); padding:4px; font-size:11px;">...and ${filtered.length - 100} more</div>`;
    }
    listEl.innerHTML = html;

    // Click to select bee's hex
    listEl.querySelectorAll('.bee-row').forEach(row => {
      row.addEventListener('click', () => {
        const q = parseInt((row as HTMLElement).dataset.beeQ || '0');
        const r = parseInt((row as HTMLElement).dataset.beeR || '0');
        this.world.inputState.selectedHex = { q, r };
      });
    });
  }

  private reassignBees(): void {
    const world = this.world;
    const total = world.bees.length;
    const foragerTarget = Math.max(1, Math.round(world.settings.foragerRatio * total));
    const nurseTarget = Math.max(1, Math.round(world.settings.nurseRatio * total));
    const scoutTarget = Math.max(1, Math.round(world.settings.scoutRatio * total));
    const haulerTarget = Math.max(1, Math.round(world.settings.haulerRatio * total));

    let foragers = world.bees.filter(b => b.role === BeeRole.Forager).length;
    let nurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
    let scouts = world.bees.filter(b => b.role === BeeRole.Scout).length;
    let haulers = world.bees.filter(b => b.role === BeeRole.Hauler).length;

    const assignToNeeded = (bee: BeeEntity, _fromRole: BeeRole, fromCount: { v: number }) => {
      if (foragers < foragerTarget) { bee.role = BeeRole.Forager; fromCount.v--; foragers++; }
      else if (nurses < nurseTarget) { bee.role = BeeRole.Nurse; fromCount.v--; nurses++; }
      else if (scouts < scoutTarget) { bee.role = BeeRole.Scout; fromCount.v--; scouts++; }
      else if (haulers < haulerTarget) { bee.role = BeeRole.Hauler; fromCount.v--; haulers++; }
      else { bee.role = BeeRole.Builder; fromCount.v--; }
    };

    for (const bee of world.bees) {
      const isIdle = bee.state === 'idle' || bee.state === 'idle_at_hive' || bee.state === 'resting';
      if (!isIdle) continue;

      if (bee.role === BeeRole.Forager && foragers > foragerTarget) {
        const c = { v: foragers };
        assignToNeeded(bee, BeeRole.Forager, c);
        foragers = c.v;
      } else if (bee.role === BeeRole.Nurse && nurses > nurseTarget) {
        const c = { v: nurses };
        assignToNeeded(bee, BeeRole.Nurse, c);
        nurses = c.v;
      } else if (bee.role === BeeRole.Scout && scouts > scoutTarget) {
        const c = { v: scouts };
        assignToNeeded(bee, BeeRole.Scout, c);
        scouts = c.v;
      } else if (bee.role === BeeRole.Hauler && haulers > haulerTarget) {
        const c = { v: haulers };
        assignToNeeded(bee, BeeRole.Hauler, c);
        haulers = c.v;
      } else if (bee.role === BeeRole.Builder) {
        if (foragers < foragerTarget) { bee.role = BeeRole.Forager; foragers++; }
        else if (nurses < nurseTarget) { bee.role = BeeRole.Nurse; nurses++; }
        else if (scouts < scoutTarget) { bee.role = BeeRole.Scout; scouts++; }
        else if (haulers < haulerTarget) { bee.role = BeeRole.Hauler; haulers++; }
      }
    }
  }

  update(): void {
    if (!this.world) return;

    // Update resource display with max capacities
    const honeyMax = this.world.grid.cellsOfType(TerrainType.HoneyStorage).length * HONEY_STORAGE_CAPACITY;
    const nectarMax = this.world.grid.cellsOfType(TerrainType.Processing).length * NECTAR_STORAGE_CAPACITY;
    this.setText('res-honey', `${this.world.resources.honey.toFixed(1)}/${honeyMax}`);
    this.setText('res-nectar', `${this.world.resources.nectar.toFixed(1)}/${nectarMax}`);
    this.setText('res-pollen', this.world.resources.pollen.toFixed(1));
    this.setText('res-beebread', this.world.resources.beeBread.toFixed(2));
    this.setText('res-wax', this.world.resources.wax.toFixed(1));
    const foragers = this.world.bees.filter(b => b.role === BeeRole.Forager).length;
    const nurses = this.world.bees.filter(b => b.role === BeeRole.Nurse).length;
    const scouts = this.world.bees.filter(b => b.role === BeeRole.Scout).length;
    const haulers = this.world.bees.filter(b => b.role === BeeRole.Hauler).length;
    const builders = this.world.bees.filter(b => b.role === BeeRole.Builder).length;
    let beeText = `${this.world.bees.length} (${foragers}F/${nurses}N/${scouts}S/${haulers}H/${builders}B)`;
    if (this.world.deathCount > 0) beeText += ` [${this.world.deathCount} died]`;
    this.setText('res-bees', beeText);

    // Update time display
    const dp = this.world.dayProgress;
    let timeOfDay: string;
    if (dp < DAWN_END) timeOfDay = 'Dawn';
    else if (dp < 0.25) timeOfDay = 'Morning';
    else if (dp < 0.5) timeOfDay = 'Midday';
    else if (dp < NIGHT_START) timeOfDay = 'Afternoon';
    else if (dp < 0.85) timeOfDay = 'Evening';
    else timeOfDay = 'Night';
    this.setText('time-text', `Day ${this.world.dayCount} - ${timeOfDay}`);

    // Update build button affordability
    document.querySelectorAll('.build-btn').forEach(btn => {
      const buildType = (btn as HTMLElement).dataset.build as string;
      const cost = BUILD_COSTS[buildType];
      if (cost) {
        const canAfford = this.world.resources.wax >= cost.wax && this.world.resources.honey >= cost.honey;
        (btn as HTMLElement).style.opacity = canAfford ? '1' : '0.4';
      }
    });

    // Update notification
    const notifEl = document.getElementById('build-notification');
    if (notifEl) {
      if (this.world.notificationTimer > 0) {
        notifEl.textContent = this.world.notification;
        notifEl.classList.add('visible');
        this.world.notificationTimer -= 1 / 60;
      } else {
        notifEl.classList.remove('visible');
      }
    }

    this.updateDebugPanel(foragers, nurses, scouts, builders, haulers);
    this.updateBeesPanel();
    this.updateHoverTooltip();
    this.updateSelectionPanel();
  }

  private updateDebugPanel(foragers: number, nurses: number, scouts: number, builders: number, haulers: number): void {
    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.fpsLastTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsLastTime = now;
    }

    // Only update DOM if panel is open
    const panel = document.getElementById('debug-panel');
    if (!panel || !panel.classList.contains('debug-open')) return;

    this.setText('dbg-tick', this.world.tickCount.toString());
    this.setText('dbg-day', this.world.dayCount.toString());
    this.setText('dbg-day-pct', (this.world.dayProgress * 100).toFixed(1) + '%');
    this.setText('dbg-fps', this.currentFps.toString());

    this.setText('dbg-foragers', foragers.toString());
    this.setText('dbg-nurses', nurses.toString());
    this.setText('dbg-scouts', scouts.toString());
    this.setText('dbg-builders', builders.toString());
    this.setText('dbg-haulers', haulers.toString());
    this.setText('dbg-total-bees', this.world.bees.length.toString());

    // Flower stats
    let totalFlowers = 0;
    let flowersWithNectar = 0;
    for (const cell of this.world.grid.cells.values()) {
      if (cell.terrain === TerrainType.Flower) {
        totalFlowers++;
        if (cell.nectarAmount > 0.01) flowersWithNectar++;
      }
    }
    this.setText('dbg-flowers-total', totalFlowers.toString());
    this.setText('dbg-flowers-nectar', flowersWithNectar.toString());

    // Resources
    const honeyMax = this.world.grid.cellsOfType(TerrainType.HoneyStorage).length * HONEY_STORAGE_CAPACITY;
    this.setText('dbg-honey', `${this.world.resources.honey.toFixed(1)} / ${honeyMax}`);
    this.setText('dbg-nectar', this.world.resources.nectar.toFixed(1));
    this.setText('dbg-pollen', this.world.resources.pollen.toFixed(1));
    this.setText('dbg-beebread', this.world.resources.beeBread.toFixed(2));
    this.setText('dbg-wax', this.world.resources.wax.toFixed(1));
  }

  private terrainLabel(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private cellSummary(cell: HexCell): string {
    switch (cell.terrain) {
      case TerrainType.Flower:
        return `Nectar ${(cell.nectarAmount * 100).toFixed(0)}%`;
      case TerrainType.HoneyStorage:
        return `Honey ${cell.honeyStored.toFixed(1)}/${HONEY_STORAGE_CAPACITY}`;
      case TerrainType.PollenStorage:
        return `Pollen ${cell.pollenStored.toFixed(1)}/${POLLEN_STORAGE_CAPACITY}`;
      case TerrainType.Processing:
        return `Nectar ${cell.nectarStored.toFixed(1)}/${NECTAR_STORAGE_CAPACITY}`;
      case TerrainType.Brood:
        return cell.broodActive ? `Brood ${(cell.broodProgress * 100).toFixed(0)}%` : 'Empty';
      case TerrainType.Tree:
        return `Resin ${(cell.resinAmount * 100).toFixed(0)}%`;
      case TerrainType.Waystation:
        return `Nectar ${cell.nectarStored.toFixed(1)}/${WAYSTATION_NECTAR_CAPACITY} Pollen ${cell.pollenStored.toFixed(1)}/${WAYSTATION_POLLEN_CAPACITY}`;
      default:
        return '';
    }
  }

  private updateHoverTooltip(): void {
    const tooltip = document.getElementById('hex-hover')!;
    const hovered = this.world.inputState.hoveredHex;
    const selected = this.world.inputState.selectedHex;

    if (!hovered || (selected && hovered.q === selected.q && hovered.r === selected.r)) {
      tooltip.classList.remove('visible');
      return;
    }

    const cell = this.world.grid.get(hovered.q, hovered.r);
    if (!cell) {
      tooltip.classList.remove('visible');
      return;
    }

    let text: string;
    if (!cell.explored && !this.world.debugFogDisabled) {
      text = 'Unexplored - send scouts to reveal';
    } else {
      const label = this.terrainLabel(cell.terrain);
      const summary = this.cellSummary(cell);
      const beeCount = this.world.bees.filter(b => b.q === hovered.q && b.r === hovered.r).length;
      text = label;
      if (summary) text += ` - ${summary}`;
      if (beeCount > 0) text += ` (${beeCount} bee${beeCount > 1 ? 's' : ''})`;
    }

    tooltip.textContent = text;
    tooltip.classList.add('visible');

    const mx = this.world.inputState.lastMouseX;
    const my = this.world.inputState.lastMouseY;
    tooltip.style.left = (mx + 16) + 'px';
    tooltip.style.top = (my - 8) + 'px';
  }

  private updateSelectionPanel(): void {
    const panel = document.getElementById('hex-info')!;
    const content = document.getElementById('hex-info-content')!;
    const sel = this.world.inputState.selectedHex;

    if (!sel) {
      panel.classList.remove('visible');
      return;
    }

    const cell = this.world.grid.get(sel.q, sel.r);
    if (!cell || (!cell.explored && !this.world.debugFogDisabled)) {
      panel.classList.remove('visible');
      return;
    }

    panel.classList.add('visible');
    // Auto-close role panel on mobile when selection opens
    document.getElementById('role-panel')?.classList.remove('mobile-open');
    let html = `<div class="info-header">${this.terrainLabel(cell.terrain)}</div>`;
    html += `<div>Position: ${cell.q}, ${cell.r}</div>`;

    if (cell.terrain === TerrainType.Flower) {
      html += `<div>Nectar: ${(cell.nectarAmount * 100).toFixed(0)}% / ${(cell.nectarMax * 100).toFixed(0)}%</div>`;
      html += `<div>Pollen: ${(cell.pollenAmount * 100).toFixed(0)}% / ${(cell.pollenMax * 100).toFixed(0)}%</div>`;
    }
    if (cell.terrain === TerrainType.Tree) {
      html += `<div>Resin: ${(cell.resinAmount * 100).toFixed(0)}%</div>`;
    }
    if (cell.terrain === TerrainType.HoneyStorage) {
      html += `<div>Honey: ${cell.honeyStored.toFixed(1)}/${HONEY_STORAGE_CAPACITY}</div>`;
    }
    if (cell.terrain === TerrainType.PollenStorage) {
      html += `<div>Pollen: ${cell.pollenStored.toFixed(1)}/${POLLEN_STORAGE_CAPACITY}</div>`;
    }
    if (cell.terrain === TerrainType.Processing) {
      html += `<div>Nectar: ${cell.nectarStored.toFixed(1)}/${NECTAR_STORAGE_CAPACITY}</div>`;
      if (cell.processingProgress > 0) {
        html += `<div>Processing: ${(cell.processingProgress * 100).toFixed(0)}%</div>`;
      }
    }
    if (cell.terrain === TerrainType.Brood) {
      html += cell.broodActive
        ? `<div>Brood progress: ${(cell.broodProgress * 100).toFixed(0)}%</div>`
        : `<div>Empty - needs honey + bee bread</div>`;
    }
    if (cell.terrain === TerrainType.Waystation) {
      html += `<div>Nectar: ${cell.nectarStored.toFixed(1)}/${WAYSTATION_NECTAR_CAPACITY}</div>`;
      html += `<div>Pollen: ${cell.pollenStored.toFixed(1)}/${WAYSTATION_POLLEN_CAPACITY}</div>`;
    }
    if (cell.pheromone > 0.01) {
      html += `<div>Pheromone: ${(cell.pheromone * 100).toFixed(0)}%</div>`;
    }

    // Detailed bee list
    const beesHere = this.world.bees.filter(b => b.q === sel.q && b.r === sel.r);
    if (beesHere.length > 0) {
      html += `<div class="bee-list">`;
      html += `<div><b>Bees: ${beesHere.length}</b></div>`;
      for (const bee of beesHere.slice(0, 8)) {
        const state = bee.state.replace(/_/g, ' ');
        let carry = '';
        if (bee.carrying.nectar > 0) carry += ` [${bee.carrying.nectar.toFixed(2)} nectar]`;
        if (bee.carrying.pollen > 0) carry += ` [${bee.carrying.pollen.toFixed(2)} pollen]`;
        const energyPct = (bee.energy * 100).toFixed(0);
        html += `<div class="bee-entry">#${bee.id} ${bee.role} - ${state}${carry} E:${energyPct}%</div>`;
      }
      if (beesHere.length > 8) {
        html += `<div class="bee-entry">...and ${beesHere.length - 8} more</div>`;
      }
      html += `</div>`;
    }

    content.innerHTML = html;
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}
