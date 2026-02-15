import { World } from '../world/world';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private initialized = false;
  private volume = 0.3;

  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      // Audio not available
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05);
    }
  }

  /** Play event sounds from world queue */
  processEvents(world: World): void {
    if (!this.ctx || !this.initialized) return;

    while (world.pendingSounds.length > 0) {
      const sound = world.pendingSounds.shift()!;
      switch (sound) {
        case 'harvest':
          this.playTone(880, 0.15, 0.18, 'sine');
          break;
        case 'build':
          this.playNoise(0.2, 0.25);
          break;
        case 'hatch':
          this.playAscendingTone();
          break;
      }
    }
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number, volume: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start(now);
  }

  private playAscendingTone(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}
