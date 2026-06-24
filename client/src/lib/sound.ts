// Procedural sound system — all SFX are synthesized with the Web Audio API at
// runtime (no audio files, no copyrighted samples). Resumes on first user gesture.
import type { WeaponCategory } from "./fps";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let wind: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

function noise(): AudioBuffer {
  const c = ac()!;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Must be called from a user gesture (e.g. the "drop in" click) to unlock audio. */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") c.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() {
  return muted;
}

function env(node: AudioNode, gain: number, attack: number, decay: number, t0: number) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g);
  g.connect(master!);
  return g;
}

function noiseBurst(dur: number, gain: number, freq: number, type: BiquadFilterType, t0: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise();
  src.playbackRate.value = 1;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  src.connect(filt);
  env(filt, gain, 0.001, dur, t0);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType, t0: number, slideTo?: number) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env(osc, gain, 0.002, dur, t0);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sound = {
  // vol (0..1) makes other players' / NPC shots quieter with distance (cheap spatial)
  shot(category: WeaponCategory = "assault", vol = 1) {
    const c = ac();
    if (!c || muted || vol <= 0.02) return;
    const t = c.currentTime;
    const cfg: Record<WeaponCategory, { g: number; f: number; d: number; crack: number }> = {
      assault: { g: 0.5, f: 1400, d: 0.14, crack: 220 },
      smg: { g: 0.4, f: 1800, d: 0.09, crack: 260 },
      pistol: { g: 0.45, f: 1200, d: 0.12, crack: 200 },
      shotgun: { g: 0.7, f: 700, d: 0.28, crack: 120 },
      sniper: { g: 0.85, f: 900, d: 0.4, crack: 90 },
    };
    const w = cfg[category];
    noiseBurst(w.d, w.g * vol, w.f, "lowpass", t);
    noiseBurst(w.d * 0.5, w.g * 0.6 * vol, w.f * 2.5, "highpass", t);
    tone(w.crack, w.d * 0.9, w.g * 0.5 * vol, "sawtooth", t, w.crack * 0.4);
  },
  reload(vol = 1) {
    const c = ac();
    if (!c || muted || vol <= 0.02) return;
    const t = c.currentTime;
    noiseBurst(0.04, 0.25 * vol, 2600, "highpass", t);
    noiseBurst(0.05, 0.3 * vol, 1800, "bandpass", t + 0.25);
    noiseBurst(0.06, 0.35 * vol, 1200, "lowpass", t + 0.6);
  },
  pickup() {
    const c = ac();
    if (!c || muted) return;
    const t = c.currentTime;
    tone(740, 0.07, 0.22, "triangle", t, 980);
    tone(1180, 0.09, 0.2, "triangle", t + 0.07);
  },
  empty() {
    const c = ac();
    if (!c || muted) return;
    noiseBurst(0.03, 0.25, 3200, "highpass", c.currentTime);
  },
  footstep() {
    const c = ac();
    if (!c || muted) return;
    noiseBurst(0.06, 0.12, 500, "lowpass", c.currentTime);
  },
  jump() {
    const c = ac();
    if (!c || muted) return;
    tone(420, 0.12, 0.2, "sine", c.currentTime, 700);
  },
  land() {
    const c = ac();
    if (!c || muted) return;
    noiseBurst(0.12, 0.25, 300, "lowpass", c.currentTime);
  },
  hit(head = false) {
    const c = ac();
    if (!c || muted) return;
    tone(head ? 1500 : 900, 0.06, 0.3, "square", c.currentTime, head ? 2200 : 1100);
  },
  kill() {
    const c = ac();
    if (!c || muted) return;
    const t = c.currentTime;
    tone(700, 0.08, 0.3, "triangle", t, 1000);
    tone(1100, 0.1, 0.28, "triangle", t + 0.08, 1500);
  },
  impact() {
    const c = ac();
    if (!c || muted) return;
    noiseBurst(0.05, 0.18, 3000, "highpass", c.currentTime);
  },
  ui() {
    const c = ac();
    if (!c || muted) return;
    tone(880, 0.03, 0.15, "square", c.currentTime);
  },
  notify() {
    const c = ac();
    if (!c || muted) return;
    const t = c.currentTime;
    tone(660, 0.08, 0.2, "sine", t, 880);
    tone(990, 0.1, 0.18, "sine", t + 0.08);
  },
  startWind() {
    const c = ac();
    if (!c || wind) return;
    const src = c.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.05;
    src.connect(filt);
    filt.connect(g);
    g.connect(master!);
    src.start();
    // slow gust modulation
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start();
    wind = { src, gain: g };
  },
  stopWind() {
    if (wind) {
      try {
        wind.src.stop();
      } catch {
        /* already stopped */
      }
      wind = null;
    }
  },
};
