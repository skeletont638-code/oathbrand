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
} as const;
