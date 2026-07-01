export const TUNING = {
  brand: { maxEmbers: 5, pulseRangeM: 12, hollowDesatRamp: [0, .18, .38, .60, .82, 1] as const, // index = embers lost
           illusoryFlickerRangeM: 3 },
  player: { walkSpeed: 3.2, radius: 0.4, height: 1.7, interactRangeM: 2.2,
            light: { damage: 1, windupMs: 260, activeMs: 180, recoverMs: 420, arcDeg: 70, rangeM: 1.9 },
            heavy: { damage: 2, windupMs: 620, activeMs: 220, recoverMs: 700, arcDeg: 90, rangeM: 2.2 },
            stepDistM: 2.4, stepMs: 240, guardShoveM: 1.2 },
  enemies: {
    soldier: { hp: 3, speed: 1.6, aggroM: 9, attack: { damage: 1, windupMs: 700, activeMs: 200, recoverMs: 900, rangeM: 1.8 } },
    archer:  { hp: 2, speed: 1.4, aggroM: 14, repositionM: 5, shot: { damage: 1, speedM: 7, windupMs: 900, cooldownMs: 2200 } },
    wraith:  { hp: 2, speed: 2.3, aggroM: 11, lunge: { damage: 1, windupMs: 500, activeMs: 260, recoverMs: 1100, rangeM: 2.6 } },
    forsworn:{ hp: 24, phaseAt: [16, 8], speed: 1.9 },
  },
} as const;
