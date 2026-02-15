import { World } from '../world/world';
import { InputMode, BeeRole, TerrainType, BuildType, HexCell, BeeEntity, BeeState, FlowerType } from '../types';
import { InputHandler } from '../input/inputHandler';
import { NIGHT_START, DAWN_END, BUILD_COSTS, HONEY_STORAGE_CAPACITY, NECTAR_STORAGE_CAPACITY, POLLEN_STORAGE_CAPACITY, WAYSTATION_NECTAR_CAPACITY, WAYSTATION_POLLEN_CAPACITY, WAX_WORKS_HONEY_CAPACITY, NECTAR_CELL_CAPACITY } from '../constants';
import { hexToPixel, hexDistance, hexNeighbors, hexKey } from '../hex/hex';
import { computePath } from '../entities/beeAI';
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

  /** Sync UI controls to match current world settings (call after restore) */
  syncFromWorld(): void {
    this.syncSpeedButtons();
    this.syncRoleSliders();
  }

  private bindModeButtons(): void {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as InputMode;
        this.inputHandler.setMode(mode);
      });
    });
  }

  private formatBuildCost(cost: { wax: number; honey: number }): string {
    const parts: string[] = [];
    if (cost.wax > 0) parts.push(`${cost.wax} wax`);
    if (cost.honey > 0) parts.push(`${cost.honey} honey`);
    return parts.join(', ') || 'free';
  }

  private bindBuildButtons(): void {
    document.querySelectorAll('.build-btn').forEach(btn => {
      const buildType = (btn as HTMLElement).dataset.build as BuildType;
      const cost = BUILD_COSTS[buildType];
      if (cost) {
        const costSpan = btn.querySelector('.cost');
        if (costSpan) costSpan.textContent = this.formatBuildCost(cost);
      }
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
        this.syncSpeedButtons();
      });
    });
    // Sync active state to match restored world settings
    this.syncSpeedButtons();
  }

  private syncSpeedButtons(): void {
    const activeSpeed = this.world.settings.paused ? 0 : this.world.settings.speedMultiplier;
    document.querySelectorAll('.speed-btn').forEach(btn => {
      const speed = parseInt((btn as HTMLElement).dataset.speed || '1');
      btn.classList.toggle('active', speed === activeSpeed);
    });
  }

  private bindRoleSliders(): void {
    const settingsKey: Record<string, keyof Pick<typeof this.world.settings, 'nurseCount' | 'scoutCount' | 'haulerCount' | 'builderCount'>> = {
      nurse: 'nurseCount',
      scout: 'scoutCount',
      hauler: 'haulerCount',
      builder: 'builderCount',
    };
    const roleMin: Record<string, number> = { nurse: 1, scout: 1, hauler: 0, builder: 1 };

    const change = (role: string, delta: number) => {
      const key = settingsKey[role];
      if (!key) return;
      const min = roleMin[role] ?? 0;
      const newVal = this.world.settings[key] + delta;
      if (newVal < min) return;
      // Don't allow total assigned to exceed total bees
      const s = this.world.settings;
      const totalAssigned = s.nurseCount + s.scoutCount + s.haulerCount + s.builderCount + delta;
      if (delta > 0 && totalAssigned >= this.world.bees.length) return;
      this.world.settings[key] = newVal;
      this.syncRoleDisplays();
      this.reassignBees();
    };

    document.querySelectorAll('.role-minus').forEach(btn => {
      btn.addEventListener('click', () => change((btn as HTMLElement).dataset.role || '', -1));
    });
    document.querySelectorAll('.role-plus').forEach(btn => {
      btn.addEventListener('click', () => change((btn as HTMLElement).dataset.role || '', 1));
    });
  }

  private syncRoleDisplays(): void {
    const s = this.world.settings;
    this.setText('count-nurse', s.nurseCount.toString());
    this.setText('count-scout', s.scoutCount.toString());
    this.setText('count-hauler', s.haulerCount.toString());
    this.setText('count-builder', s.builderCount.toString());
    this.updateForagerDisplay();

    // Sync disabled state on +/- buttons
    const totalAssigned = s.nurseCount + s.scoutCount + s.haulerCount + s.builderCount;
    const atMax = totalAssigned >= this.world.bees.length - 1; // keep at least 1 forager
    const roleMin: Record<string, number> = { nurse: 1, scout: 1, hauler: 0, builder: 1 };
    document.querySelectorAll('.role-minus').forEach(btn => {
      const role = (btn as HTMLElement).dataset.role || '';
      const key = role + 'Count' as keyof typeof s;
      (btn as HTMLButtonElement).disabled = (s[key] as number) <= (roleMin[role] ?? 0);
    });
    document.querySelectorAll('.role-plus').forEach(btn => {
      (btn as HTMLButtonElement).disabled = atMax;
    });
  }

  private syncRoleSliders(): void {
    this.syncRoleDisplays();
  }

  private updateForagerDisplay(): void {
    const s = this.world.settings;
    const assigned = Math.max(1, s.nurseCount) + Math.max(1, s.scoutCount) + s.haulerCount + Math.max(1, s.builderCount);
    const foragerCount = Math.max(0, this.world.bees.length - assigned);
    const el = document.getElementById('val-forager');
    if (el) el.textContent = foragerCount.toString();
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

    // Copy flower arrangement to clipboard
    document.getElementById('dbg-copy-flowers')?.addEventListener('click', () => {
      const clusters = this.findFlowerClusters();
      clusters.sort((a, b) => a.dist - b.dist);
      const lines = [
        `Seed: ${this.world.worldSeed}`,
        `Clusters: ${clusters.length}`,
        '',
        'idx | pos | dist | biome | type | size | flowers',
        '--- | --- | ---- | ----- | ---- | ---- | -------',
      ];
      clusters.forEach((c, i) => {
        lines.push(`${i} | (${c.centerQ},${c.centerR}) | ${c.dist} | ${c.biome} | ${c.type} | ${c.size} | ${c.flowers}`);
      });
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        const btn = document.getElementById('dbg-copy-flowers');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Flowers', 1500); }
      });
    });
  }

  /** Flood-fill to find connected flower clusters for debug output */
  private findFlowerClusters() {
    const visited = new Set<string>();
    const clusters: { centerQ: number; centerR: number; dist: number; biome: string; type: string; size: number; flowers: string }[] = [];

    for (const cell of this.world.grid.cells.values()) {
      if (cell.terrain !== TerrainType.Flower) continue;
      const key = hexKey(cell.q, cell.r);
      if (visited.has(key)) continue;

      const queue = [cell];
      const members: { q: number; r: number }[] = [];
      visited.add(key);

      while (queue.length > 0) {
        const cur = queue.pop()!;
        members.push({ q: cur.q, r: cur.r });
        for (const h of hexNeighbors(cur.q, cur.r)) {
          const nk = hexKey(h.q, h.r);
          if (visited.has(nk)) continue;
          const nc = this.world.grid.get(h.q, h.r);
          if (!nc || nc.terrain !== TerrainType.Flower) continue;
          visited.add(nk);
          queue.push(nc);
        }
      }

      let sumQ = 0, sumR = 0;
      for (const m of members) { sumQ += m.q; sumR += m.r; }
      const centerQ = Math.round(sumQ / members.length);
      const centerR = Math.round(sumR / members.length);

      clusters.push({
        centerQ, centerR,
        dist: hexDistance(0, 0, centerQ, centerR),
        biome: cell.biome,
        type: cell.flowerType,
        size: members.length,
        flowers: members.map(m => `(${m.q},${m.r})`).join(' '),
      });
    }

    return clusters;
  }

  /** Let Game register callbacks without circular imports */
  setGameCallbacks(onSave: () => void, onNewGame: () => void): void {
    this.onSave = onSave;
    this.onNewGame = onNewGame;
  }

  /** Sync role inputs to match world settings (after load) */
  private syncSlidersFromWorld(): void {
    this.syncRoleSliders();
  }

  private bindBeesPanel(): void {
    const panel = document.getElementById('bees-panel');
    const tab = document.getElementById('bees-tab');
    const closeBtn = document.getElementById('bees-close');
    if (!panel || !tab) return;

    // Close by default on mobile
    if (window.innerWidth <= 600) {
      panel.classList.remove('bees-open');
    }

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
    const s = world.settings;
    const nurseTarget = Math.max(1, s.nurseCount);
    const scoutTarget = Math.max(1, s.scoutCount);
    const haulerTarget = s.haulerCount;
    const builderTarget = Math.max(1, s.builderCount);

    let nurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
    let scouts = world.bees.filter(b => b.role === BeeRole.Scout).length;
    let haulers = world.bees.filter(b => b.role === BeeRole.Hauler).length;
    let builders = world.bees.filter(b => b.role === BeeRole.Builder).length;
    let foragers = world.bees.filter(b => b.role === BeeRole.Forager).length;

    const foragerTarget = Math.max(0, world.bees.length - nurseTarget - scoutTarget - haulerTarget - builderTarget);

    const pickNewRole = (): BeeRole => {
      if (nurses < nurseTarget) { nurses++; return BeeRole.Nurse; }
      if (scouts < scoutTarget) { scouts++; return BeeRole.Scout; }
      if (haulers < haulerTarget) { haulers++; return BeeRole.Hauler; }
      if (builders < builderTarget) { builders++; return BeeRole.Builder; }
      foragers++; return BeeRole.Forager;
    };

    const sendToHive = (bee: BeeEntity) => {
      // Drop any carried resources (they're lost — bee abandons task)
      bee.carrying.nectar = 0;
      bee.carrying.pollen = 0;
      bee.explorationTarget = null;
      bee.danceTicks = 0;
      bee.stateTimer = 0;
      // If already at hive, go idle immediately
      if (hexDistance(bee.q, bee.r, 0, 0) <= 1) {
        bee.state = BeeState.Idle;
        bee.path = [];
      } else {
        bee.state = BeeState.ReturningToHive;
        bee.path = computePath(bee.q, bee.r, 0, 0, world);
      }
    };

    const isOverTarget = (role: BeeRole): boolean => {
      switch (role) {
        case BeeRole.Nurse: return nurses > nurseTarget;
        case BeeRole.Scout: return scouts > scoutTarget;
        case BeeRole.Hauler: return haulers > haulerTarget;
        case BeeRole.Builder: return builders > builderTarget;
        case BeeRole.Forager: return foragers > foragerTarget;
      }
    };

    const decCount = (role: BeeRole) => {
      switch (role) {
        case BeeRole.Nurse: nurses--; break;
        case BeeRole.Scout: scouts--; break;
        case BeeRole.Hauler: haulers--; break;
        case BeeRole.Builder: builders--; break;
        case BeeRole.Forager: foragers--; break;
      }
    };

    // Reassign idle bees first (cheaper — no interruption needed)
    for (const bee of world.bees) {
      if (bee.state === BeeState.Hungry || bee.state === BeeState.Eating) continue;
      const isIdle = bee.state === BeeState.Idle || bee.state === BeeState.IdleAtHive || bee.state === BeeState.Resting;
      if (!isIdle) continue;
      if (!isOverTarget(bee.role)) continue;

      decCount(bee.role);
      const newRole = pickNewRole();
      bee.role = newRole;
      bee.state = BeeState.Idle;
    }

    // Then reassign busy bees if still needed — interrupt and send to hive
    for (const bee of world.bees) {
      if (bee.state === BeeState.Hungry || bee.state === BeeState.Eating) continue;
      const isIdle = bee.state === BeeState.Idle || bee.state === BeeState.IdleAtHive || bee.state === BeeState.Resting;
      if (isIdle) continue;
      if (!isOverTarget(bee.role)) continue;

      decCount(bee.role);
      const newRole = pickNewRole();
      bee.role = newRole;
      sendToHive(bee);
    }
  }

  update(): void {
    if (!this.world) return;

    // Update resource display with max capacities
    const honeyMax = this.world.grid.cellsOfType(TerrainType.HoneyStorage).length * HONEY_STORAGE_CAPACITY;
    const nectarMax = this.world.grid.cellsOfType(TerrainType.Processing).length * NECTAR_STORAGE_CAPACITY
      + this.world.grid.cellsOfType(TerrainType.NectarStorage).length * NECTAR_CELL_CAPACITY;
    this.setText('res-honey', `${this.world.resources.honey.toFixed(1)}/${honeyMax}`);
    this.setText('res-nectar', `${this.world.resources.nectar.toFixed(1)}/${nectarMax}`);
    this.setText('res-pollen', this.world.resources.pollen.toFixed(1));
    this.setText('res-beebread', this.world.resources.beeBread.toFixed(2));
    this.setText('res-wax', this.world.resources.wax.toFixed(1));

    // Yesterday's net change
    const d = this.world.resourceDeltaYesterday;
    this.setDelta('res-delta-honey', d.honey);
    this.setDelta('res-delta-nectar', d.nectar);
    this.setDelta('res-delta-pollen', d.pollen);
    this.setDelta('res-delta-beebread', d.beeBread);
    this.setDelta('res-delta-wax', d.wax);
    let beeText = `Bees: ${this.world.bees.length}`;
    if (this.world.deathCount > 0) beeText += ` (${this.world.deathCount} died)`;
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

    this.updateForagerDisplay();
    this.updateDebugPanel();
    this.updateBeesPanel();
    this.updateHoverTooltip();
    this.updateSelectionPanel();
  }

  private updateDebugPanel(): void {
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

  }

  private terrainLabel(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private flowerTypeName(ft: FlowerType): string {
    return ft.charAt(0).toUpperCase() + ft.slice(1);
  }

  private biomeName(cell: HexCell): string {
    return cell.biome.charAt(0).toUpperCase() + cell.biome.slice(1);
  }

  private terrainWithBiome(cell: HexCell): string {
    const label = this.terrainLabel(cell.terrain);
    if (cell.terrain === TerrainType.Grass || cell.terrain === TerrainType.Tree || cell.terrain === TerrainType.Water) {
      return `${label} (${this.biomeName(cell)})`;
    }
    return label;
  }

  private cellSummary(cell: HexCell): string {
    switch (cell.terrain) {
      case TerrainType.Flower:
        return `${this.flowerTypeName(cell.flowerType)} - Nectar ${(cell.nectarAmount * 100).toFixed(0)}%`;
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
      case TerrainType.WaxWorks:
        return `Honey ${cell.honeyStored.toFixed(1)}/${WAX_WORKS_HONEY_CAPACITY}`;
      case TerrainType.NectarStorage:
        return `Nectar ${cell.nectarStored.toFixed(1)}/${NECTAR_CELL_CAPACITY}`;
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
      const label = this.terrainWithBiome(cell);
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
    let html = `<div class="info-header">${this.terrainWithBiome(cell)}</div>`;
    html += `<div>Position: ${cell.q}, ${cell.r}</div>`;

    if (cell.terrain === TerrainType.Flower) {
      html += `<div>Type: ${this.flowerTypeName(cell.flowerType)}</div>`;
      html += `<div>Nectar: ${(cell.nectarAmount * 100).toFixed(0)}% / ${(cell.nectarMax * 100).toFixed(0)}%</div>`;
      if (cell.pollenMax > 0) {
        html += `<div>Pollen: ${(cell.pollenAmount * 100).toFixed(0)}% / ${(cell.pollenMax * 100).toFixed(0)}%</div>`;
      } else {
        html += `<div>Pollen: None</div>`;
      }
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
    if (cell.terrain === TerrainType.WaxWorks) {
      html += `<div>Honey: ${cell.honeyStored.toFixed(1)}/${WAX_WORKS_HONEY_CAPACITY}</div>`;
    }
    if (cell.terrain === TerrainType.NectarStorage) {
      html += `<div>Nectar: ${cell.nectarStored.toFixed(1)}/${NECTAR_CELL_CAPACITY}</div>`;
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

  private setDelta(id: string, value: number): void {
    const el = document.getElementById(id);
    if (!el) return;
    if (this.world.dayCount <= 1) {
      el.textContent = '';
      return;
    }
    const abs = Math.abs(value);
    const text = value >= 0 ? `+${abs.toFixed(1)}` : `-${abs.toFixed(1)}`;
    el.textContent = text;
    el.className = 'res-delta ' + (value > 0.05 ? 'positive' : value < -0.05 ? 'negative' : 'zero');
  }
}
