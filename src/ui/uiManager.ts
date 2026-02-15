import { World } from '../world/world';
import { InputMode, BeeRole, TerrainType, BuildType, HexCell } from '../types';
import { InputHandler } from '../input/inputHandler';
import { NIGHT_START, DAWN_END, BUILD_COSTS, HONEY_STORAGE_CAPACITY, NECTAR_STORAGE_CAPACITY, POLLEN_STORAGE_CAPACITY } from '../constants';

export class UIManager {
  private world!: World;
  private inputHandler!: InputHandler;

  init(world: World, inputHandler: InputHandler): void {
    this.world = world;
    this.inputHandler = inputHandler;
    this.bindModeButtons();
    this.bindBuildButtons();
    this.bindSpeedButtons();
    this.bindRoleSliders();
    this.bindRoleToggle();
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
    const foragerVal = document.getElementById('val-forager')!;
    const nurseVal = document.getElementById('val-nurse')!;
    const scoutVal = document.getElementById('val-scout')!;
    const builderVal = document.getElementById('val-builder')!;

    const update = () => {
      let fv = parseInt(foragerSlider.value);
      let nv = parseInt(nurseSlider.value);
      let sv = parseInt(scoutSlider.value);

      // Clamp so total <= 100
      if (fv + nv + sv > 100) {
        sv = 100 - fv - nv;
        if (sv < 0) {
          nv = 100 - fv;
          sv = 0;
          nurseSlider.value = nv.toString();
        }
        scoutSlider.value = sv.toString();
      }

      const bv = 100 - fv - nv - sv;
      foragerVal.textContent = fv + '%';
      nurseVal.textContent = nv + '%';
      scoutVal.textContent = sv + '%';
      builderVal.textContent = bv + '%';

      this.world.settings.foragerRatio = fv / 100;
      this.world.settings.nurseRatio = nv / 100;
      this.world.settings.scoutRatio = sv / 100;

      this.reassignBees();
    };

    foragerSlider.addEventListener('input', update);
    nurseSlider.addEventListener('input', update);
    scoutSlider.addEventListener('input', update);
  }

  private bindRoleToggle(): void {
    const btn = document.getElementById('role-toggle');
    const panel = document.getElementById('role-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      panel.classList.toggle('mobile-open');
    });
  }

  private reassignBees(): void {
    const world = this.world;
    const total = world.bees.length;
    const foragerTarget = Math.round(world.settings.foragerRatio * total);
    const nurseTarget = Math.round(world.settings.nurseRatio * total);
    const scoutTarget = Math.round(world.settings.scoutRatio * total);

    let foragers = world.bees.filter(b => b.role === BeeRole.Forager).length;
    let nurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;
    let scouts = world.bees.filter(b => b.role === BeeRole.Scout).length;

    for (const bee of world.bees) {
      const isIdle = bee.state === 'idle' || bee.state === 'idle_at_hive' || bee.state === 'resting';
      if (!isIdle) continue;

      // Determine best role for this bee
      if (bee.role === BeeRole.Forager && foragers > foragerTarget) {
        if (nurses < nurseTarget) { bee.role = BeeRole.Nurse; foragers--; nurses++; }
        else if (scouts < scoutTarget) { bee.role = BeeRole.Scout; foragers--; scouts++; }
        else { bee.role = BeeRole.Builder; foragers--; }
      } else if (bee.role === BeeRole.Nurse && nurses > nurseTarget) {
        if (foragers < foragerTarget) { bee.role = BeeRole.Forager; nurses--; foragers++; }
        else if (scouts < scoutTarget) { bee.role = BeeRole.Scout; nurses--; scouts++; }
        else { bee.role = BeeRole.Builder; nurses--; }
      } else if (bee.role === BeeRole.Scout && scouts > scoutTarget) {
        if (foragers < foragerTarget) { bee.role = BeeRole.Forager; scouts--; foragers++; }
        else if (nurses < nurseTarget) { bee.role = BeeRole.Nurse; scouts--; nurses++; }
        else { bee.role = BeeRole.Builder; scouts--; }
      } else if (bee.role === BeeRole.Builder) {
        if (foragers < foragerTarget) { bee.role = BeeRole.Forager; foragers++; }
        else if (nurses < nurseTarget) { bee.role = BeeRole.Nurse; nurses++; }
        else if (scouts < scoutTarget) { bee.role = BeeRole.Scout; scouts++; }
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
    const builders = this.world.bees.filter(b => b.role === BeeRole.Builder).length;
    this.setText('res-bees', `${this.world.bees.length} (${foragers}F/${nurses}N/${scouts}S/${builders}B)`);

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

    this.updateHoverTooltip();
    this.updateSelectionPanel();
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
    if (!cell.explored) {
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
    if (!cell || !cell.explored) {
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
        html += `<div class="bee-entry">#${bee.id} ${bee.role} - ${state}${carry}</div>`;
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
