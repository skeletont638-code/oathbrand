/**
 * AudioManager — OATHBRAND's whole sound layer (Task 17), registered as the
 * last game Subsystem so it ticks after the Brand each frame.
 *
 * The RECORDED CC0 pack (scripts/fetch-audio.sh → assets/audio/) is the
 * primary voice — looping dungeon/wind/dark-music ambience under the beds and
 * recorded swing/hit/door/bow one-shots — while everything without a recorded
 * source (heartbeat, stone-reverb impulse, musical cues, whisper/breath/cloth
 * textures) is synthesized. Every recorded voice ALSO has a synth fallback, so
 * a missing file thins the texture but never silences the game. Structure:
 *
 *   • Two looping ambient beds per zone, equal-power crossfaded over 2 s on a
 *     zone change (`setZoneLayers`, fed by `zone-entered`).
 *   • A threat channel (`setThreat`, fed by the brand's 60 Hz `brand-pulse`):
 *     it DUCKS the ambience −9 dB and fades a heartbeat layer in, its rate
 *     racing 60→110 bpm with the pulse. The 60 Hz stream is throttled — a
 *     pulse only stores a target; gains move on smoothed ramps in `update`,
 *     and threat eases to 0 when the brand goes quiet (it emits nothing once
 *     no enemy is near, so we cannot wait for a "cleared" event).
 *   • A synthesized stone reverb (ConvolverNode, 1.8 s exp-decay noise IR) the
 *     SFX and heartbeat feed, for the cold-hall tail.
 *   • Event-driven one-shot SFX (swings, hits, bow, doors [deduped], the kneel
 *     motif, the vista swell, the boss card, per-ending cues), all little
 *     oscillator/noise voices.
 *   • `positional` sources: panned in 3-D and low-passed when a wall occludes
 *     the line to the listener (the existing `raycastWall`, injected).
 *
 * The pure gain/threat/crossfade arithmetic lives in `./mixer` (WebAudio-free,
 * unit-tested). This file is the only place those numbers meet an AudioContext,
 * and it is never imported by a test — so its `window`/`AudioContext` use is
 * safe under node's test runner.
 */
import * as THREE from 'three';
import { TUNING } from '../content/tuning';
import type { EventBus } from '../engine/events';
import type { Subsystem } from '../engine/Game';
import {
  ambienceGain,
  bpmToIntervalMs,
  clamp01,
  crossfadeCurves,
  heartGain,
  heartRateBpm,
} from './mixer';

const AUDIO = TUNING.audio;

// The recorded CC0 pack (see assets/LICENSES.md + scripts/fetch-audio.sh):
// looping ambience (amb-dungeon / amb-wind / amb-dark) plus one-shot SFX
// (swing / hit / door / bow). Vite emits each as a URL; if the pack was never
// fetched the glob is empty and every voice falls back to its synth version —
// the game is never silent for a missing file.
const SFX_URLS = import.meta.glob<string>(['/assets/audio/*.ogg', '/assets/audio/*.wav'], {
  query: '?url',
  import: 'default',
});

/** One live ambient bed: its fader plus the nodes to tear down after a fade. */
interface Layer {
  id: string;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
}

/** Per-bed recipe. `file` names the PRIMARY recorded CC0 loop (basename in
 *  assets/audio/, looped at `rate`); when the file is absent/undecoded the bed
 *  synthesizes instead: winds/breath/whisper/cloth/drip ride filtered noise;
 *  pads/hums use live oscillators (seam-free). */
interface BedSpec {
  kind: 'wind' | 'pad' | 'hum' | 'drip' | 'whisper' | 'cloth' | 'breath';
  /** Recorded CC0 loop backing this bed (primary). Absent ⇒ always synth. */
  file?: string;
  /** Playback rate of the recorded loop — pitch/pace variety from one file. */
  rate?: number;
  cut?: number;
  q?: number;
  lfo?: number;
  tone?: number[];
  gain: number;
}

// Recorded mapping: amb-wind = OGA "Wind Whoosh Loop"; amb-dungeon = OGA
// "Loopable Dungeon Ambience"; amb-dark = OGA "Derelict" (CC0 Dark Music).
// Whisper/breath/cloth have no recorded source in the pack — synth only.
const BEDS: Record<string, BedSpec> = {
  'amb-ash-wind': { kind: 'wind', file: 'amb-wind', rate: 0.9, cut: 520, q: 0.7, lfo: 0.08, gain: 0.8 },
  'amb-vigil-synth': { kind: 'pad', file: 'amb-dark', rate: 1, tone: [110, 164.81, 220], lfo: 0.05, gain: 0.55 },
  'amb-hall-drone': { kind: 'pad', file: 'amb-dungeon', rate: 1, tone: [55, 82.41], lfo: 0.04, gain: 0.75 },
  'amb-ember-hum': { kind: 'hum', file: 'amb-dark', rate: 0.8, tone: [69.3], lfo: 0.9, gain: 0.4 },
  'amb-crypt-drip': { kind: 'drip', file: 'amb-dungeon', rate: 0.8, cut: 1800, q: 9, gain: 0.85 },
  'amb-wraith-whisper': { kind: 'whisper', cut: 1400, q: 3, lfo: 0.3, gain: 0.7 },
  'amb-rampart-wind': { kind: 'wind', file: 'amb-wind', rate: 1, cut: 720, q: 0.6, lfo: 0.13, gain: 0.9 },
  'amb-banner-cloth': { kind: 'cloth', cut: 900, q: 0.8, lfo: 0.55, gain: 0.6 },
  'amb-throne-hush': { kind: 'wind', file: 'amb-dungeon', rate: 0.9, cut: 300, q: 0.9, lfo: 0.05, gain: 0.7 },
  'amb-summit-wind': { kind: 'wind', file: 'amb-wind', rate: 1.15, cut: 1100, q: 0.5, lfo: 0.22, gain: 1.0 },
  'amb-dragon-breath': { kind: 'breath', cut: 220, lfo: 0.11, gain: 0.8 },
  'amb-garden-hush': { kind: 'wind', file: 'amb-wind', rate: 0.75, cut: 1600, q: 0.5, lfo: 0.09, gain: 0.5 },
};

/** Deterministic PRNG so a bed's noise (and thus its seamless loop) is stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable-ish string hash → a bed's PRNG seed. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface AudioDeps {
  bus: EventBus;
  /** Resolve a zone id to its two ambience layer ids (main injects the registry). */
  ambienceFor: (zone: string) => string[];
  /** True when a wall blocks the straight line listener→(sx,sz) — the existing
   *  GridCollider.raycastWall, wired by main. Absent ⇒ never occluded. */
  occluded?: (sx: number, sz: number) => boolean;
}

export class AudioManager implements Subsystem {
  private ctx: AudioContext | null = null;

  // Bus graph (built at init).
  private master!: GainNode;
  private dry!: GainNode;
  private reverbSend!: GainNode;
  private ambienceBus!: GainNode;
  /** User ambience trim, downstream of the threat-ducked ambienceBus so the
   *  volume dial and the duck automation don't fight over one gain. */
  private ambienceTrim!: GainNode;
  private heartBus!: GainNode;
  private sfxBus!: GainNode;

  // User volume dials (Task 18 settings), 0..1 multipliers over the tuned mix.
  // Stored so they survive being set before the graph is built (init needs a
  // gesture), then applied in buildGraph and live thereafter.
  private userMaster = 1;
  private userAmbience = 1;
  private userSfx = 1;

  // Ambience crossfade state.
  private layers: Layer[] = [];
  private layerIds: string[] = [];
  private pendingLayers: string[] | null = null;
  private noiseCache = new Map<string, AudioBuffer>();
  /** Decoded CC0 recordings by basename — one-shots ('swing'/'hit'/'door'/
   *  'bow') and ambience loops ('amb-dungeon'/'amb-wind'/'amb-dark'). Any
   *  missing entry ⇒ that voice synthesizes. */
  private samples = new Map<string, AudioBuffer>();

  // Threat state (smoothed off the 60 Hz brand pulse).
  private threat = 0;
  private pendingThreat = 0;
  private gotPulse = false;
  private lastAmb = 1;
  private lastHeart = 0;
  private beatMs = 0;

  // Door dedupe (the shortcut loop double-fires `door-opened`).
  private lastDoorAt = -1;

  private readonly scratch = new THREE.Vector3();

  constructor(private readonly deps: AudioDeps) {
    const bus = deps.bus;
    bus.on('zone-entered', (e) => this.setZoneLayers(deps.ambienceFor(e.zone)));
    bus.on('brand-pulse', (e) => {
      this.pendingThreat = clamp01(e.intensity);
      this.gotPulse = true;
    });
    bus.on('player-hit', () => this.cue('hit'));
    bus.on('player-rekindled', () => this.cue('rekindle'));
    bus.on('player-hollowed', () => this.cue('hollow'));
    bus.on('ember-gained', () => this.cue('ember'));
    bus.on('vision-played', () => this.cue('swell-vista'));
    bus.on('cue', (e) => this.cue(e.id));
    bus.on('door-opened', () => {
      const now = this.ctx ? this.ctx.currentTime : 0;
      // Dedupe: the ramparts shortcut loop emits `door-opened` twice in a beat.
      if (this.ctx && now - this.lastDoorAt < AUDIO_DOOR_DEBOUNCE_S) return;
      this.lastDoorAt = now;
      this.cue('door');
    });
  }

  /**
   * Create + resume the AudioContext. MUST be called from a user gesture
   * (autoplay policy) — main hooks the first pointerdown/keydown. Idempotent:
   * a second call just resumes a suspended context.
   */
  init(afterGesture: boolean): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    if (!afterGesture) return;
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.buildGraph();
    void this.ctx.resume();
    void this.loadSamples();
    // Seed whatever zone was set before the gesture arrived.
    const seed = this.pendingLayers;
    this.pendingLayers = null;
    if (seed) this.setZoneLayers(seed);
  }

  /** True once the context is live and running (for headless verification). */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Names of the recorded CC0 samples decoded and ready (for verification). */
  get loadedSamples(): string[] {
    return [...this.samples.keys()];
  }

  /** Decode the fetched CC0 pack (ambience loops + one-shots). Per-file
   *  failure is swallowed — that voice just uses its synth version instead.
   *  When decoding finishes, any beds already playing as synth are re-spawned
   *  so the recorded loops take over (a 2 s crossfade, not a cut). */
  private async loadSamples(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      Object.entries(SFX_URLS).map(async ([path, resolve]) => {
        const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.(ogg|wav)$/, '');
        try {
          const url = await resolve();
          const res = await fetch(url);
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.samples.set(name, buf);
        } catch {
          /* missing/undecodable → synth fallback */
        }
      }),
    );
    // Swap live synth beds over to their recorded loops (same ids, forced).
    if (this.layerIds.length > 0) {
      const ids = this.layerIds;
      this.layerIds = [];
      this.setZoneLayers(ids);
    }
  }

  /** Play a decoded sample by name into `sink` (default: the SFX bus); false
   *  if it isn't loaded (→ synth fallback). */
  private playSample(name: string, gain: number, rate = 1, sink?: AudioNode): boolean {
    const buf = this.samples.get(name);
    if (!buf || !this.ctx) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(sink ?? this.sfxBus);
    src.start();
    return true;
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = AUDIO.master * this.userMaster;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.connect(this.master);

    // Synthesized stone reverb: exp-decay noise impulse → wet trim → master.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeReverbIR();
    const wet = ctx.createGain();
    wet.gain.value = AUDIO.reverb.wet;
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.master);

    // Buses. Ambience stays dry (the beds are spacious already); SFX + the
    // heartbeat feed the room tail. The ambienceBus gain is automated by the
    // threat duck, so the user ambience dial rides a separate trim downstream.
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = ambienceGain(0);
    this.ambienceTrim = ctx.createGain();
    this.ambienceTrim.gain.value = this.userAmbience;
    this.ambienceBus.connect(this.ambienceTrim);
    this.ambienceTrim.connect(this.dry);

    this.heartBus = ctx.createGain();
    this.heartBus.gain.value = 0;
    this.heartBus.connect(this.dry);
    this.heartBus.connect(this.reverbSend);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.userSfx;
    this.sfxBus.connect(this.dry);
    this.sfxBus.connect(this.reverbSend);
  }

  // --- user volume dials (Task 18 settings) -------------------------------

  /** Master output volume (0..1) — a multiplier over the tuned master trim. */
  setMasterVolume(v: number): void {
    this.userMaster = clamp01(v);
    if (this.ctx) this.master.gain.setTargetAtTime(AUDIO.master * this.userMaster, this.ctx.currentTime, 0.02);
  }

  /** Ambience-bed volume (0..1). Rides the trim downstream of the threat duck. */
  setAmbienceVolume(v: number): void {
    this.userAmbience = clamp01(v);
    if (this.ctx) this.ambienceTrim.gain.setTargetAtTime(this.userAmbience, this.ctx.currentTime, 0.02);
  }

  /** One-shot SFX volume (0..1). */
  setSfxVolume(v: number): void {
    this.userSfx = clamp01(v);
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(this.userSfx, this.ctx.currentTime, 0.02);
  }

  /** A 1.8 s stereo exponential-decay noise impulse — the cold-stone tail. */
  private makeReverbIR(): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * AUDIO.reverb.durationS);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    const rnd = mulberry32((0x0a7b ^ len) >>> 0);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // exponential decay, tapered to exactly 0 at the tail (no click).
        const env = Math.exp(-AUDIO.reverb.decay * t) * (1 - t);
        d[i] = (rnd() * 2 - 1) * env;
      }
    }
    return ir;
  }

  // --- ambience ------------------------------------------------------------

  /**
   * Crossfade to a new pair of ambient beds over 2 s (equal-power). Called on
   * every `zone-entered`; a no-op when the ids are unchanged. Before init it
   * just remembers the ids for `init` to apply.
   */
  setZoneLayers(ids: string[]): void {
    if (!this.ctx) {
      this.pendingLayers = ids.slice();
      return;
    }
    if (sameIds(ids, this.layerIds)) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = AUDIO.crossfadeMs / 1000;
    const { out, in: inC } = crossfadeCurves(32);

    // Fade the current beds out along the equal-power OUT curve, then stop.
    const leaving = this.layers;
    for (const layer of leaving) {
      rampCurve(layer.gain.gain, scaleCurve(out, AUDIO.layerGain), now, dur);
      for (const s of layer.sources) {
        try {
          s.stop(now + dur + 0.05);
        } catch {
          /* already stopped */
        }
      }
    }
    window.setTimeout(() => {
      for (const layer of leaving) layer.gain.disconnect();
    }, AUDIO.crossfadeMs + 120);

    // Fade the new beds in along the equal-power IN curve.
    this.layers = ids.map((id) => {
      const layer = this.spawnBed(id);
      rampCurve(layer.gain.gain, scaleCurve(inC, AUDIO.layerGain), now, dur);
      return layer;
    });
    this.layerIds = ids.slice();
  }

  /** Build one looping ambient bed (gain starts at 0; the caller ramps it).
   *  A bed with a decoded recorded loop (`spec.file`) plays it as the PRIMARY
   *  voice; otherwise the bed synthesizes per its `kind`. */
  private spawnBed(id: string): Layer {
    const ctx = this.ctx!;
    const spec = BEDS[id] ?? { kind: 'wind', cut: 700, q: 0.6, lfo: 0.1, gain: 0.7 };
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ambienceBus);

    const sources: AudioScheduledSourceNode[] = [];
    const t0 = ctx.currentTime;

    const recorded = spec.file ? this.samples.get(spec.file) : undefined;
    if (recorded) {
      // Recorded CC0 loop — the primary bed voice. Rate varies pitch/pace so
      // one file serves several zones without reading identical.
      const src = ctx.createBufferSource();
      src.buffer = recorded;
      src.loop = true;
      src.playbackRate.value = spec.rate ?? 1;
      const g = ctx.createGain();
      g.gain.value = spec.gain;
      src.connect(g).connect(gain);
      src.start(t0);
      sources.push(src);
      return { id, gain, sources };
    }

    if (spec.kind === 'pad' || spec.kind === 'hum') {
      // Live detuned oscillators — no loop seam. A slow LFO breathes the level.
      const bedGain = ctx.createGain();
      bedGain.gain.value = spec.gain;
      bedGain.connect(gain);
      for (const f of spec.tone ?? [70]) {
        for (const detune of [-4, 4]) {
          const o = ctx.createOscillator();
          o.type = spec.kind === 'hum' ? 'triangle' : 'sawtooth';
          o.frequency.value = f;
          o.detune.value = detune;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = spec.kind === 'hum' ? 260 : 620;
          const g = ctx.createGain();
          g.gain.value = 0.5 / (spec.tone ?? [70]).length;
          o.connect(lp).connect(g).connect(bedGain);
          o.start(t0);
          sources.push(o);
        }
      }
      // faint noise "air" over the pad
      const air = this.noiseSource(4.7, hashSeed(id));
      const airLp = ctx.createBiquadFilter();
      airLp.type = 'lowpass';
      airLp.frequency.value = 900;
      const airG = ctx.createGain();
      airG.gain.value = 0.05;
      air.connect(airLp).connect(airG).connect(bedGain);
      air.start(t0);
      sources.push(air);
      this.applyLfo(bedGain.gain, spec.gain, spec.lfo ?? 0.05, 0.25, t0, sources);
    } else if (spec.kind === 'drip') {
      // Sparse resonant "plinks" over near-silence — a wet crypt.
      const src = this.noiseSource(9.3, hashSeed(id));
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = spec.cut ?? 1800;
      bp.Q.value = spec.q ?? 9;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(gain);
      src.start(t0);
      sources.push(src);
      // scheduled drips via a gated gain (short blips every ~1.1–2.4 s)
      const rnd = mulberry32(hashSeed(id) ^ 0x99);
      let t = t0 + 0.5;
      const until = t0 + 180; // schedule ahead; beds are re-spawned per zone entry
      while (t < until) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(spec.gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        t += 1.1 + rnd() * 1.3;
      }
    } else {
      // wind / whisper / cloth / breath: filtered noise + a tremolo LFO.
      const src = this.noiseSource(spec.kind === 'breath' ? 6.1 : 5.3, hashSeed(id));
      const filt = ctx.createBiquadFilter();
      filt.type = spec.kind === 'whisper' ? 'bandpass' : 'lowpass';
      filt.frequency.value = spec.cut ?? 700;
      if (spec.q) filt.Q.value = spec.q;
      const g = ctx.createGain();
      g.gain.value = spec.gain;
      src.connect(filt).connect(g).connect(gain);
      src.start(t0);
      sources.push(src);
      const depth = spec.kind === 'cloth' ? 0.7 : spec.kind === 'breath' ? 0.85 : 0.5;
      this.applyLfo(g.gain, spec.gain, spec.lfo ?? 0.1, depth, t0, sources);
    }

    return { id, gain, sources };
  }

  /**
   * A looping noise BufferSource with a seam-crossfaded buffer. Fixed-seed beds
   * pass `cache = true` (the default) so the buffer is reused across zone
   * entries; random-seed one-shots pass `cache = false` — a fresh buffer that
   * never enters `noiseCache`, so the cache can't grow unbounded on every swing.
   */
  private noiseSource(seconds: number, seed: number, cache = true): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const key = `${seconds}:${seed}`;
    let buf = cache ? this.noiseCache.get(key) : undefined;
    if (!buf) {
      const n = Math.floor(ctx.sampleRate * seconds);
      buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      const rnd = mulberry32(seed);
      for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
      // Seam smoothing: ease the tail toward the head so looping is clickless
      // (the runtime low-pass removes any residual step).
      const xf = Math.min(2048, n >> 2);
      for (let k = 0; k < xf; k++) {
        const a = k / xf;
        d[n - xf + k] = d[n - xf + k] * (1 - a) + d[k] * a;
      }
      if (cache) this.noiseCache.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  /** Modulate `param` around `base` by a slow sine LFO (an OscillatorNode). */
  private applyLfo(
    param: AudioParam,
    base: number,
    rateHz: number,
    depth: number,
    t0: number,
    sink: AudioScheduledSourceNode[],
  ): void {
    const ctx = this.ctx!;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rateHz;
    const amt = ctx.createGain();
    amt.gain.value = base * depth;
    lfo.connect(amt).connect(param);
    lfo.start(t0);
    sink.push(lfo);
  }

  // --- threat (duck + heartbeat) ------------------------------------------

  /** Set the target threat directly (0..1). Ramps apply in `update`. */
  setThreat(t: number): void {
    this.pendingThreat = clamp01(t);
    this.gotPulse = true;
  }

  /** Subsystem tick: smooth the threat, duck the ambience, run the heartbeat. */
  update(dtMs: number): void {
    if (!this.ctx) return;
    // The brand pulses only while a threat is in range; when it stops emitting
    // we ease threat to 0 ourselves (no "pulse cleared" event exists).
    if (this.gotPulse) {
      this.threat = this.pendingThreat;
      this.gotPulse = false;
    } else if (this.threat > 0) {
      this.threat = Math.max(0, this.threat - (AUDIO.threatReleasePerSec * dtMs) / 1000);
    }

    const now = this.ctx.currentTime;
    const tau = AUDIO.smoothTau;
    const ambTarget = ambienceGain(this.threat);
    if (Math.abs(ambTarget - this.lastAmb) > 0.004) {
      this.ambienceBus.gain.setTargetAtTime(ambTarget, now, tau);
      this.lastAmb = ambTarget;
    }
    const heartTarget = heartGain(this.threat) * AUDIO.heartGain;
    if (Math.abs(heartTarget - this.lastHeart) > 0.004) {
      this.heartBus.gain.setTargetAtTime(heartTarget, now, tau);
      this.lastHeart = heartTarget;
    }

    // Heartbeat scheduler — a lub-dub per beat, its rate racing with threat.
    if (heartGain(this.threat) < 0.02) {
      this.beatMs = 0; // silent: don't burst when the threat returns
      return;
    }
    const interval = bpmToIntervalMs(heartRateBpm(this.threat));
    this.beatMs += dtMs;
    if (this.beatMs >= interval) {
      this.beatMs = this.beatMs > interval * 2 ? 0 : this.beatMs - interval;
      this.thump(now, 1);
      this.thump(now + 0.13, 0.62);
    }
  }

  /** One heart thump: two pitch-dropping sines through the heart bus. */
  private thump(t0: number, amp: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(amp, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    g.connect(this.heartBus);
    for (const [f0, f1] of [
      [52, 30],
      [78, 42],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + 0.16);
      o.connect(g);
      o.start(t0);
      o.stop(t0 + 0.22);
    }
  }

  // --- SFX / cues ----------------------------------------------------------

  /** Play a named one-shot cue. Unknown ids are ignored (the cue union is open). */
  cue(id: string): void {
    if (!this.ctx) return;
    const sink = this.sfxBus;
    switch (id) {
      case 'swing-light':
        if (!this.playSample('swing', AUDIO.sfx.swingLight)) {
          this.whoosh(AUDIO.sfx.swingLight, 900, 2600, 0.16, sink);
        }
        return;
      case 'swing-heavy':
        if (!this.playSample('swing', AUDIO.sfx.swingHeavy, 0.82)) {
          this.whoosh(AUDIO.sfx.swingHeavy, 500, 1700, 0.26, sink);
        }
        return;
      case 'hit':
        if (!this.playSample('hit', AUDIO.sfx.hit)) this.thud(AUDIO.sfx.hit, 150, 60, 0.16, sink);
        return;
      case 'bow':
        if (!this.playSample('bow', AUDIO.sfx.bow)) this.twang(AUDIO.sfx.bow, sink);
        return;
      case 'door':
        if (!this.playSample('door', AUDIO.sfx.door)) this.door(AUDIO.sfx.door, sink);
        return;
      case 'ember':
        return this.tone([880, 1320], AUDIO.sfx.ember, 'sine', 0.004, 0.12, sink);
      case 'motif-kneel':
        return this.tone([196, 293.66, 392], AUDIO.sfx.motifKneel, 'sine', 0.09, 1.5, sink);
      case 'rekindle':
        return this.rise([261.63, 392, 523.25], AUDIO.sfx.rekindle, sink);
      case 'hollow':
        return this.fall([220, 146.83, 98], AUDIO.sfx.hollow, sink);
      case 'swell-vista':
        return this.swell(AUDIO.sfx.swellVista, sink);
      case 'card-boss':
        return this.brass(AUDIO.sfx.cardBoss, sink);
      case 'eye-open':
        return this.rise([49, 98, 147], AUDIO.sfx.eyeOpen, sink);
      case 'ending-oath-kept':
      case 'ending-flame':
        return this.chord([261.63, 329.63, 392, 523.25], AUDIO.sfx.ending, sink);
      case 'ending-oath-broken':
        return this.chord([261.63, 311.13, 392, 415.3], AUDIO.sfx.ending, sink);
      case 'ending-hollow':
        return this.chord([196, 233.08, 293.66], AUDIO.sfx.ending * 0.8, sink);
      default:
        return;
    }
  }

  /**
   * Play `id` positionally at `mesh`'s world position: panned in 3-D and
   * low-passed when a wall occludes the line to the listener. Used for the
   * bow twang at a firing archer.
   */
  positional(mesh: THREE.Object3D, id: string): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    mesh.getWorldPosition(this.scratch);
    const p = this.scratch;

    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = AUDIO.positionalRefDistM;
    panner.maxDistance = AUDIO.positionalMaxDistM;
    setNodePosition(panner, p.x, p.y, p.z);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const occ = this.deps.occluded?.(p.x, p.z) ?? false;
    lp.frequency.value = occ ? AUDIO.occlusion.wallHz : AUDIO.occlusion.openHz;

    lp.connect(panner);
    panner.connect(this.sfxBus);
    // Route the chosen voice into the occlusion→panner chain — the recorded
    // sample when decoded, else the synth fallback.
    if (id === 'bow') {
      if (!this.playSample('bow', AUDIO.sfx.bow, 1, lp)) this.twang(AUDIO.sfx.bow, lp);
    } else if (!this.playSample('hit', AUDIO.sfx.hit, 1, lp)) {
      this.thud(AUDIO.sfx.hit, 150, 60, 0.16, lp);
    }
  }

  // --- listener ------------------------------------------------------------

  /** Update the 3-D listener each rendered frame (position + facing). */
  setListener(x: number, y: number, z: number, yaw: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    // yaw 0 faces -z (three 'YXZ' convention).
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if ('positionX' in l && l.positionX) {
      const now = this.ctx.currentTime;
      l.positionX.setTargetAtTime(x, now, 0.02);
      l.positionY.setTargetAtTime(y, now, 0.02);
      l.positionZ.setTargetAtTime(z, now, 0.02);
      l.forwardX.setTargetAtTime(fx, now, 0.02);
      l.forwardY.setTargetAtTime(0, now, 0.02);
      l.forwardZ.setTargetAtTime(fz, now, 0.02);
      l.upX.setTargetAtTime(0, now, 0.02);
      l.upY.setTargetAtTime(1, now, 0.02);
      l.upZ.setTargetAtTime(0, now, 0.02);
    } else {
      // Deprecated but universally supported fallback.
      (l as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
      (
        l as unknown as {
          setOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void;
        }
      ).setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // --- voice primitives ----------------------------------------------------

  /** A noise "whoosh" through a band-pass that sweeps up then down (a swing). */
  private whoosh(peak: number, f0: number, f1: number, dur: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const src = this.noiseSource(0.5, (Math.random() * 1e9) | 0, false);
    src.loop = false;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.linearRampToValueAtTime(f1, t0 + dur * 0.4);
    bp.frequency.linearRampToValueAtTime(f0 * 0.7, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(sink);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** A low thud: a pitch-dropping sine plus a click transient (a landed hit). */
  private thud(peak: number, f0: number, f1: number, dur: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(sink);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    const n = this.noiseSource(0.2, (Math.random() * 1e9) | 0, false);
    n.loop = false;
    const nlp = ctx.createBiquadFilter();
    nlp.type = 'lowpass';
    nlp.frequency.value = 1600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(peak * 0.7, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    n.connect(nlp).connect(ng).connect(sink);
    n.start(t0);
    n.stop(t0 + 0.08);
  }

  /** A crossbow twang: a pitch-dropping triangle with a noisy attack. */
  private twang(peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    g.connect(sink);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.12);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.15);
    const n = this.noiseSource(0.1, (Math.random() * 1e9) | 0, false);
    n.loop = false;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(peak * 0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    n.connect(ng).connect(sink);
    n.start(t0);
    n.stop(t0 + 0.05);
  }

  /** A heavy door: a low wooden thunk under a slow, gusty filtered-noise groan. */
  private door(peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const dur = 0.6;
    const n = this.noiseSource(1.0, (Math.random() * 1e9) | 0, false);
    n.loop = false;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(240, t0);
    bp.frequency.linearRampToValueAtTime(160, t0 + dur);
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak * 0.6, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(bp).connect(g).connect(sink);
    n.start(t0);
    n.stop(t0 + dur + 0.05);
    // closing thunk
    this.thud(peak, 120, 55, 0.2, sink);
  }

  /** Additive partials with a soft attack + long release (a bell/motif tone). */
  private tone(
    freqs: number[],
    peak: number,
    type: OscillatorType,
    attack: number,
    dur: number,
    sink: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(sink);
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const pg = ctx.createGain();
      pg.gain.value = 1 / (i + 1); // gentle partial rolloff
      o.connect(pg).connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    });
  }

  /** A sustained chord swell (endings). */
  private chord(freqs: number[], peak: number, sink: AudioNode): void {
    this.tone(freqs, peak, 'triangle', 0.25, 2.6, sink);
  }

  /** An ascending arpeggio (rekindle / eye-wake). */
  private rise(freqs: number[], peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    freqs.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.09;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      g.connect(sink);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(t0);
      o.stop(t0 + 0.45);
    });
  }

  /** A descending arpeggio (hollowing). */
  private fall(freqs: number[], peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    freqs.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.14;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      g.connect(sink);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      o.connect(lp).connect(g);
      o.start(t0);
      o.stop(t0 + 0.65);
    });
  }

  /** A rising low-pass sweep over a chord — the vista opening up. */
  private swell(peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const dur = 1.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t0);
    lp.frequency.exponentialRampToValueAtTime(3200, t0 + dur);
    lp.connect(g).connect(sink);
    for (const f of [130.81, 196, 261.63, 392]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + dur + 0.5);
    }
  }

  /** A low detuned brass hit — the boss card. */
  private brass(peak: number, sink: AudioNode): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const dur = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.04);
    g.gain.setValueAtTime(peak, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(g).connect(sink);
    for (const f of [55, 82.41, 110]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      }
    }
  }
}

const AUDIO_DOOR_DEBOUNCE_S = 0.25;

/** Multiply an equal-power curve by a target gain (fresh array). */
function scaleCurve(curve: Float32Array, k: number): Float32Array {
  const out = new Float32Array(curve.length);
  for (let i = 0; i < curve.length; i++) out[i] = curve[i] * k;
  return out;
}

/** Schedule a value-curve, falling back to a linear ramp if the graph refuses
 *  an overlapping curve (never let a scheduling edge throw into the frame). */
function rampCurve(param: AudioParam, curve: Float32Array, now: number, dur: number): void {
  try {
    param.cancelScheduledValues(now);
    param.setValueCurveAtTime(curve, now, dur);
  } catch {
    param.setValueAtTime(curve[0], now);
    param.linearRampToValueAtTime(curve[curve.length - 1], now + dur);
  }
}

/** Position a PannerNode via the modern AudioParams or the legacy setter. */
function setNodePosition(panner: PannerNode, x: number, y: number, z: number): void {
  if ('positionX' in panner && panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    (panner as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }
}

/** Order-insensitive compare of two ambience id lists. */
function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort();
  return [...a].sort().every((v, i) => v === sb[i]);
}
