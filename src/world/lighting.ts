/**
 * Pure lighting resolver (realism pass, spec §3). Maps a ZoneDef to the shared
 * AmbientLight/DirectionalLight/HemisphereLight settings main rebinds per zone.
 * No three.js — unit-testable, owner-tunable (all numbers from TUNING.lighting).
 */
import { TUNING } from '../content/tuning';
import type { ZoneDef, ExteriorSky } from './zoneDef';

/** The v1 ambient floor when a zone sets none (mirrors main's DEFAULT_AMBIENT). */
const DEFAULT_AMBIENT = 0.35;

export interface ZoneLighting {
  ambient: number;
  key: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
}

export function resolveZoneLighting(def: ZoneDef): ZoneLighting {
  if (def.kind === 'exterior') {
    const preset: ExteriorSky = def.exteriorSky ?? 'field';
    const c = TUNING.lighting.exterior[preset];
    return {
      ambient: c.ambient,
      key: { color: c.moon.color, intensity: def.keyLightIntensity ?? c.moon.intensity },
      hemi: { sky: c.hemi.sky, ground: c.hemi.ground, intensity: c.hemi.intensity },
    };
  }
  const d = TUNING.lighting.interior.directional;
  return {
    ambient: def.ambientFloor ?? DEFAULT_AMBIENT,
    key: { color: d.color, intensity: def.keyLightIntensity ?? d.intensity },
    hemi: { sky: 0x000000, ground: 0x000000, intensity: 0 }, // interiors: no hemisphere
  };
}
