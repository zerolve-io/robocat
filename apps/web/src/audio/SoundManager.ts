// SoundManager — procedural synth audio via Web Audio API (no asset files needed)

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      console.warn('Web Audio not available');
    }
  }

  ensureResumed(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.3;
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  // === SOUND EFFECTS ===

  jump(): void {
    this.playTone(440, 0.08, 'square', 880, 0.5);
  }

  doubleJump(): void {
    this.playTone(660, 0.06, 'square', 1320, 0.4);
    setTimeout(() => this.playTone(880, 0.06, 'square', 1760, 0.3), 50);
  }

  dash(): void {
    this.playNoise(0.12, 2000, 200);
  }

  pounce(): void {
    this.playTone(300, 0.15, 'sawtooth', 80, 0.5);
  }

  pounceLand(): void {
    this.playNoise(0.08, 100, 50);
    this.playTone(80, 0.2, 'sine', 40, 0.6);
  }

  collectScrap(): void {
    this.playTone(880, 0.05, 'sine', 1200, 0.3);
    setTimeout(() => this.playTone(1100, 0.05, 'sine', 1400, 0.25), 40);
  }

  droneDestroy(): void {
    this.playNoise(0.2, 3000, 100);
    this.playTone(200, 0.3, 'sawtooth', 50, 0.5);
  }

  wallSlide(): void {
    this.playNoise(0.05, 800, 600);
  }

  death(): void {
    this.playTone(400, 0.3, 'sawtooth', 80, 0.6);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 40, 0.5), 200);
    setTimeout(() => this.playNoise(0.3, 2000, 50), 100);
  }

  zoneTransition(): void {
    // Rising arpeggio
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine', freq * 1.02, 0.35), i * 80);
    });
    // Cymbal-like noise
    setTimeout(() => this.playNoise(0.3, 8000, 2000), 250);
  }

  scoreUp(): void {
    this.playTone(600, 0.04, 'sine', 800, 0.2);
  }

  // === SYNTH PRIMITIVES ===

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    endFreq: number,
    volume: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number, filterFreq: number, filterEnd: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 1), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + duration);
  }
}

// Singleton
export const soundManager = new SoundManager();
