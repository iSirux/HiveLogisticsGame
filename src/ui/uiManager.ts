import { World } from '../world/world';
import { InputMode, BeeRole, TerrainType, BuildType } from '../types';
import { InputHandler } from '../input/inputHandler';
import { NIGHT_START, DAWN_END } from '../constants';

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
        // Highlight active build button
        document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    // Default selection
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
    const foragerVal = document.getElementById('val-forager')!;
    const nurseVal = document.getElementById('val-nurse')!;
    const builderVal = document.getElementById('val-builder')!;

    const update = () => {
      let fv = parseInt(foragerSlider.value);
      let nv = parseInt(nurseSlider.value);

      // Clamp so total <= 100
      if (fv + nv > 100) {
        nv = 100 - fv;
        nurseSlider.value = nv.toString();
      }

      const bv = 100 - fv - nv;
      foragerVal.textContent = fv + '%';
      nurseVal.textContent = nv + '%';
      builderVal.textContent = bv + '%';

      this.world.settings.foragerRatio = fv / 100;
      this.world.settings.nurseRatio = nv / 100;

      // Reassign idle bees
      this.reassignBees();
    };

    foragerSlider.addEventListener('input', update);
    nurseSlider.addEventListener('input', update);
  }

  private reassignBees(): void {
    const world = this.world;
    const total = world.bees.length;
    const foragerTarget = Math.round(world.settings.foragerRatio * total);
    const nurseTarget = Math.round(world.settings.nurseRatio * total);

    // Count current
    let foragers = world.bees.filter(b => b.role === BeeRole.Forager).length;
    let nurses = world.bees.filter(b => b.role === BeeRole.Nurse).length;

    // Only reassign idle bees
    for (const bee of world.bees) {
      const isIdle = bee.state === 'idle' || bee.state === 'idle_at_hive' || bee.state === 'resting';
      if (!isIdle) continue;

      if (bee.role === BeeRole.Forager && foragers > foragerTarget) {
        if (nurses < nurseTarget) {
          bee.role = BeeRole.Nurse;
          foragers--;
          nurses++;
        } else {
          bee.role = BeeRole.Builder;
          foragers--;
        }
      } else if (bee.role === BeeRole.Nurse && nurses > nurseTarget) {
        if (foragers < foragerTarget) {
          bee.role = BeeRole.Forager;
          nurses--;
          foragers++;
        } else {
          bee.role = BeeRole.Builder;
          nurses--;
        }
      } else if (bee.role === BeeRole.Builder) {
        if (foragers < foragerTarget) {
          bee.role = BeeRole.Forager;
          foragers++;
        } else if (nurses < nurseTarget) {
          bee.role = BeeRole.Nurse;
          nurses++;
        }
      }
    }
  }

  update(): void {
    if (!this.world) return;

    // Update resource display
    this.setText('res-honey', this.world.resources.honey.toFixed(1));
    this.setText('res-nectar', this.world.resources.nectar.toFixed(1));
    this.setText('res-wax', this.world.resources.wax.toFixed(1));
    this.setText('res-bees', this.world.bees.length.toString());

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

    // Update hex info
    this.updateHexInfo();
  }

  private updateHexInfo(): void {
    const sel = this.world.inputState.selectedHex || this.world.inputState.hoveredHex;
    const panel = document.getElementById('hex-info')!;
    const content = document.getElementById('hex-info-content')!;

    if (!sel) {
      panel.classList.remove('visible');
      return;
    }

    const cell = this.world.grid.get(sel.q, sel.r);
    if (!cell) {
      panel.classList.remove('visible');
      return;
    }

    panel.classList.add('visible');
    let html = `<div><b>${cell.terrain.replace('_', ' ')}</b></div>`;
    html += `<div>Pos: ${cell.q}, ${cell.r}</div>`;

    if (cell.terrain === TerrainType.Flower) {
      html += `<div>Nectar: ${(cell.nectarAmount * 100).toFixed(0)}%</div>`;
    }
    if (cell.terrain === TerrainType.HoneyStorage) {
      html += `<div>Honey: ${cell.honeyStored.toFixed(1)}/5</div>`;
    }
    if (cell.terrain === TerrainType.Processing) {
      html += `<div>Nectar: ${cell.nectarStored.toFixed(1)}/3</div>`;
    }
    if (cell.terrain === TerrainType.Brood) {
      html += cell.broodActive
        ? `<div>Progress: ${(cell.broodProgress * 100).toFixed(0)}%</div>`
        : `<div>Empty</div>`;
    }
    if (cell.pheromone > 0.01) {
      html += `<div>Pheromone: ${(cell.pheromone * 100).toFixed(0)}%</div>`;
    }

    // Show bees at this hex
    const beesHere = this.world.bees.filter(b => b.q === sel.q && b.r === sel.r);
    if (beesHere.length > 0) {
      html += `<div>Bees: ${beesHere.length}</div>`;
    }

    content.innerHTML = html;
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}
