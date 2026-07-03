export const TUNING = {
  brand: { maxEmbers: 5, pulseRangeM: 12, hollowDesatRamp: [0, .18, .38, .60, .82, 1] as const, // index = embers lost
           illusoryFlickerRangeM: 3 },
  player: { walkSpeed: 3.2, radius: 0.4, height: 1.7, interactRangeM: 2.2,
            light: { damage: 1, windupMs: 260, activeMs: 180, recoverMs: 420, arcDeg: 70, rangeM: 1.9 },
            heavy: { damage: 2, windupMs: 620, activeMs: 220, recoverMs: 700, arcDeg: 90, rangeM: 2.2 },
            // Callun's broken tachi (Task 15 reward): the same swings with the
            // windup pared down — a faster, hungrier weapon for a no-guard run.
            // Equipped by Combat.equipTachi() when the pickup is taken.
            tachi: {
              light: { damage: 1, windupMs: 150, activeMs: 170, recoverMs: 320, arcDeg: 70, rangeM: 1.9 },
              heavy: { damage: 2, windupMs: 400, activeMs: 210, recoverMs: 560, arcDeg: 90, rangeM: 2.2 },
            },
            stepDistM: 2.4, stepMs: 240, guardShoveM: 1.2 },
  enemies: {
    soldier: { hp: 3, speed: 1.6, aggroM: 9, alertMs: 600, // "notice" beat before the chase starts
               attack: { damage: 1, windupMs: 700, activeMs: 200, recoverMs: 900, rangeM: 1.8 } },
    // maxRangeM (Task 10): bolts despawn past this flight distance — no
    // infinite projectiles; comfortably beyond the archer's 14m aggro.
    archer:  { hp: 2, speed: 1.4, aggroM: 14, repositionM: 5, shot: { damage: 1, speedM: 7, windupMs: 900, cooldownMs: 2200, maxRangeM: 24 } },
    // alertMs (Task 10): the wraith's notice beat, mirroring the soldier's.
    wraith:  { hp: 2, speed: 2.3, aggroM: 11, alertMs: 400, lunge: { damage: 1, windupMs: 500, activeMs: 260, recoverMs: 1100, rangeM: 2.6 } },
    // THE FORSWORN (Task 15 boss). phaseAt = the hp thresholds where phases
    // turn over: P1 hp>16, P2 8<hp<=16, P3 hp<=8. Its swing mirrors the
    // player's heavy (a slow, deliberate, guard-able tachi) so the duel reads
    // as a mirror match. `trail` is the P2/P3 dark-flame floor hazard; `torchOut`
    // is the intensity the arena torches lerp to in P3 (near-black — he is read
    // only by the brand's pulse then).
    forsworn:{ hp: 24, phaseAt: [16, 8], speed: 1.9, aggroM: 11, alertMs: 500,
               attack: { damage: 2, windupMs: 620, activeMs: 220, recoverMs: 760, rangeM: 2.2 },
               trail: { lifetimeMs: 3000, damage: 1, radiusM: 1.1 },
               torchOut: 0.03 },
  },
  // --- Task 17: the dread mixer -------------------------------------------
  // All feel lives here; the AudioManager and its pure `mixer` math read it
  // and never hardcode a gain, a bpm, or a timing. The whole soundscape is
  // synthesized in WebAudio (no sample payload) — these numbers ARE the
  // instrument.
  audio: {
    master: 0.85,             // final output trim (headroom before the speakers)
    /** Zone ambience: 2 layers, each a looping synth bed, crossfaded on entry. */
    crossfadeMs: 2000,        // spec: 2 s equal-power crossfade on zone change
    layerGain: 0.5,           // nominal gain of one ambient layer (two per zone)
    /** Threat ducking: at full threat the ambience drops this many dB. */
    duckDb: -9,               // → ≈0.355 linear (the Step-1 contract: 1.0 → 0.35)
    /** Heartbeat layer: rate rises with threat; gain fades in with threat. */
    heartBpm: { min: 60, max: 110 },
    heartGain: 0.9,           // peak heartbeat bus gain (scaled by threat)
    /** Threat smoothing (the brand pulses at ~60 Hz — never churn the graph):
     *  ramps use this time-constant, and threat eases to 0 at releasePerSec
     *  when the brand stops pulsing (it emits nothing once no enemy is near). */
    smoothTau: 0.10,          // setTargetAtTime time constant, seconds
    threatReleasePerSec: 2.4, // logical decay of threat when pulses stop
    /** Synthesized stone reverb: a 1.8 s exponential-decay noise impulse. */
    reverb: { durationS: 1.8, decay: 3.4, wet: 0.20 },
    /** Positional sources muffle through walls (raycastWall → occluded). */
    occlusion: { openHz: 18000, wallHz: 480, tau: 0.05 },
    positionalRefDistM: 3,    // panner reference distance
    positionalMaxDistM: 26,   // panner rolloff cap (matches bolt/aggro reach)
    /** One-shot SFX gains (the synth voices). */
    sfx: {
      swingLight: 0.28, swingHeavy: 0.34,
      hit: 0.5, bow: 0.4, door: 0.55,
      motifKneel: 0.5, swellVista: 0.45, cardBoss: 0.6,
      ember: 0.18, rekindle: 0.5, hollow: 0.6, ending: 0.6, eyeOpen: 0.5,
      // Greater Vael Drop 1 (Task 6): the Ash-Hound's positional pant/footfall
      // and the Kneeling Hollow's bone-creak on its rise.
      pant: 0.32, boneCreak: 0.5,
    },
    /** Silence-spike (Task 6): the DreadDirector's held drop-to-silence. Rides a
     *  SEPARATE gain node over the threat-duck (the ambienceTrim pattern), so it
     *  never fights the continuous duck — the nodes multiply. A steep held slope,
     *  no strobing. `dropMs` collapses to silence, the caller HOLDS, `recoverMs`
     *  eases back to unity (restoring the live threat-driven target). */
    silence: { dropMs: 120, recoverMs: 420, steps: 24 },
  },
  // --- Greater Vael Drop 1: "The Fields" (Tasks 3–5 read these names) ------
  greaterVael: {
    hound: {
      hp: 2, speed: 2.6, aggroM: 13, alertMs: 500, leashMul: 1.5, heightM: 2.3,
      circle: { speedM: 3.4, radiusM: 6, minMs: 1400, maxMs: 3200, flankRandom: true },
      lunge:  { windupMs: 380, activeMs: 220, recoverMs: 900, speedM: 6.5, damage: 1, rangeM: 2.4 },
      animFps: 12,
    },
    kneeler: {
      hp: 3, speed: 1.7, aggroM: 10, wake: 'brand-pulse', heightM: 2.35,
      idle:  { breathScalePct: 0.8, headTiltMaxDeg: 6, tiltPeriodMs: 5200 },
      rise:  { holdMs: 700, firstStepMs: 900 },
      attack:{ windupMs: 700, activeMs: 200, recoverMs: 900, damage: 1, rangeM: 2.0 },
      inertRatio: 3, animFps: 12,
    },
    watcher: {
      heightM: 3.0, sightingRangeMinM: 16, despawnM: 10, maxVisibleSec: 4,
      sightingsPerDrop: { min: 3, max: 6 }, frozenWhileObserved: true,
      sharesScareCooldown: true, damage: 0, animFps: 0,
    },
    hag: {
      heightM: 2.5, glimpseRangeMinM: 16, recedeM: 10, damage: 0,
      fights: false, chases: false, speaks: false,
      animFps: 12,
    },
    dread: {
      minScareGapSec: 90, maxBeatsPerDrop: 10, falsePulsePerZoneMax: 2,
      gimmickUseMax: 2, watcherPerDropMax: 6,
    },
    exterior: { fogFarDefaultM: 16, lowFogCellM: 11, maxHeightStep: 3 },
  } as const,
} as const;
