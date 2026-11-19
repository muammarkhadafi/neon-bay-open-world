// Neon Bay — synthesized sound. No audio files: every sound is built with
// WebAudio oscillators and filtered noise, so the game stays fully offline.

export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  click() { this.tone(700, 0.06, 'square', 0.08); }
  pickup() { this.tone(660, 0.09, 'sine', 0.18); setTimeout(() => this.tone(990, 0.12, 'sine', 0.18), 90); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.2), i * 110)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 130)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.12), i * 160)); }
  gunshot() { this.noise(0.12, 0.5, 900); this.tone(180, 0.08, 'square', 0.25, 60); }
  punch() { this.noise(0.08, 0.35, 500); }
  crash() { this.noise(0.3, 0.5, 400); this.tone(90, 0.25, 'sawtooth', 0.2, 40); }
  sirenBlip() { this.tone(880, 0.12, 'square', 0.06, 660); }
  busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.14), i * 200)); }

  // Continuous engine hum; speed 0..1 sets pitch and volume.
  setEngine(speed, on) {
    if (!this.ctx) return;
    if (!on || speed <= 0.02) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(60 + speed * 140, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + speed * 0.05, this.ctx.currentTime, 0.1);
  }

  // Two-tone police siren while wanted.
  setSiren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
      return;
    }
    if (this.sirenTimer) return;
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.enabled) return;
      high = !high;
      this.tone(high ? 950 : 700, 0.28, 'sine', 0.05);
    }, 300);
  }

  // A lazy synthwave-ish bass line for the menu and driving.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    this.musicTimer = setInterval(() => {
      if (!this.enabled) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      this.tone(f, 0.5, 'triangle', 0.06);
      if (this.musicStep % 4 === 0) this.tone(f * 2, 0.3, 'sine', 0.03);
    }, 420);
  }
}
