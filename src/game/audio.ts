// Tiny WebAudio synth: engine drone + arcade SFX. No assets required.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  muted = false;
  started = false;

  init() {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    // noise buffer for impacts / wind
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // engine
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.Q.value = 5;
    this.engineGain.connect(this.master);
    this.filter.connect(this.engineGain);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'square';
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'triangle';
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.35;
    const g3 = this.ctx.createGain();
    g3.gain.value = 0.5;
    this.osc1.connect(this.filter);
    this.osc2.connect(g2);
    g2.connect(this.filter);
    this.subOsc.connect(g3);
    g3.connect(this.filter);
    this.osc1.start();
    this.osc2.start();
    this.subOsc.start();

    // siren (cops)
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenGain.connect(this.master);
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenOsc.start();
    this.started = true;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }

  /** speed 0..1, load 0..1 (throttle) */
  engine(speed: number, throttle: number, active: boolean) {
    if (!this.ctx || !this.osc1 || !this.engineGain || !this.filter) return;
    const t = this.ctx.currentTime;
    const base = 46 + speed * 150;
    this.osc1.frequency.setTargetAtTime(base, t, 0.05);
    this.osc2!.frequency.setTargetAtTime(base * 1.49, t, 0.05);
    this.subOsc!.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    this.filter.frequency.setTargetAtTime(420 + speed * 2200 + throttle * 500, t, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.07 + speed * 0.1 : 0, t, 0.1);
  }

  siren(level: number) {
    if (!this.ctx || !this.sirenGain || !this.sirenOsc) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(level * 0.035, t, 0.2);
    if (level > 0) {
      const wob = Math.sin(t * 7) > 0 ? 880 : 620;
      this.sirenOsc.frequency.setTargetAtTime(wob, t, 0.05);
    }
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, freq: number, sweep?: number) {
    if (!this.ctx || !this.noiseBuf || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(t + dur + 0.02);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType, to?: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(t + dur + 0.02);
  }

  swing() {
    this.noise(0.16, 0.16, 'bandpass', 1800, 500);
  }
  hit() {
    this.noise(0.22, 0.6, 'lowpass', 2400, 300);
    this.tone(220, 0.16, 0.3, 'square', 70);
  }
  knockout() {
    this.noise(0.5, 0.65, 'lowpass', 1600, 120);
    this.tone(150, 0.45, 0.35, 'sawtooth', 44);
    this.tone(640, 0.3, 0.2, 'square', 180);
  }
  crash() {
    this.noise(0.75, 0.85, 'lowpass', 3200, 80);
    this.tone(90, 0.6, 0.4, 'sawtooth', 32);
  }
  hurt() {
    this.tone(320, 0.12, 0.22, 'square', 140);
    this.noise(0.14, 0.3, 'bandpass', 900, 300);
  }
  pickup() {
    this.tone(660, 0.1, 0.2, 'square');
    window.setTimeout(() => this.tone(990, 0.14, 0.2, 'square'), 70);
  }
  nearMiss() {
    this.noise(0.3, 0.25, 'bandpass', 2600, 700);
  }
  boost() {
    this.tone(180, 0.5, 0.22, 'sawtooth', 820);
    this.noise(0.5, 0.2, 'highpass', 400, 2400);
  }
  ui() {
    this.tone(520, 0.07, 0.16, 'square');
  }
  start() {
    this.tone(330, 0.1, 0.2, 'square');
    window.setTimeout(() => this.tone(440, 0.1, 0.2, 'square'), 90);
    window.setTimeout(() => this.tone(660, 0.22, 0.22, 'square'), 180);
  }
  gameOver() {
    this.tone(400, 0.25, 0.22, 'sawtooth', 220);
    window.setTimeout(() => this.tone(260, 0.3, 0.22, 'sawtooth', 140), 200);
    window.setTimeout(() => this.tone(150, 0.7, 0.24, 'sawtooth', 60), 430);
  }
}

export const audio = new AudioEngine();
