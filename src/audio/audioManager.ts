import { World } from '../world/world';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buzzGain: GainNode | null = null;
  private initialized = false;
  private volume = 0.3;

  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.startAmbientBuzz();
    } catch {
      // Audio not available
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05);
    }
  }

  private startAmbientBuzz(): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 120;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();

    this.buzzGain = gain;
  }

  /** Update ambient buzz volume based on visible bee count */
  updateBuzz(visibleBeeCount: number): void {
    if (!this.buzzGain || !this.ctx) return;
    const target = Math.min(0.08, visibleBeeCount * 0.003);
    this.buzzGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.1);
  }

  /** Play event sounds from world queue */
  processEvents(world: World): void {
    if (!this.ctx || !this.initialized) return;

    while (world.pendingSounds.length > 0) {
      const sound = world.pendingSounds.shift()!;
      switch (sound) {
        case 'harvest':
          this.playTone(880, 0.05, 0.04, 'sine');
          break;
        case 'build':
          this.playNoise(0.08, 0.06);
          break;
        case 'hatch':
          this.playAscendingTone();
          break;
      }
    }
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume: number): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start();
  }

  private playAscendingTone(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
}
