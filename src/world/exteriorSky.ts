/**
 * Exterior backdrop for the Greater Vael zones (Task 2): a gradient sky dome,
 * a pale moon quad, and a slow ash-fall particle system — the three pieces that
 * turn the instanced forest from "floating props" into an outdoor night.
 *
 * All three are children of the zone group and carry `fog: false` (the dome
 * and moon must read THROUGH the 16 m dread fog; the ash drifts inside it).
 * `update` drifts the ash; `dispose` frees the three GPU buffers, though the
 * ZoneManager's group teardown (extended in Task 2 to cover Points/Sprite)
 * also reclaims them on a zone change.
 *
 * Pure three.js object construction — no WebGL — so it builds under vitest.
 */
import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ExteriorSky } from './zoneDef';

/** Per-preset palette: dome zenith→horizon gradient, moon tint, ash tint. */
interface SkyPalette {
  zenith: number;
  horizon: number;
  moon: number;
  ash: number;
}

const PALETTES: Record<ExteriorSky, SkyPalette> = {
  // The open fields under a bruised violet-ash sky, moon high and cold.
  field: { zenith: 0x0e1016, horizon: 0x2a2630, moon: 0xc2c5cc, ash: 0x9a9aa2 },
  // Under the dead canopy: near-black, a green-grey horizon, a dim moon.
  forest: { zenith: 0x0b0d0b, horizon: 0x1e241d, moon: 0x9aa39a, ash: 0x8f948a },
  // The gorge: ember-lit murk from the fires below, moon lost in smoke.
  gorge: { zenith: 0x100a0c, horizon: 0x2a1a16, moon: 0x7a6a60, ash: 0xb4642c },
};

/** The horizon tint of a preset — main.ts matches the scene fog/background to
 *  it so the 16 m fog dissolves into the sky instead of a flat interior grey. */
export function skyFogColor(preset: ExteriorSky): number {
  return PALETTES[preset].horizon;
}

const DOME_RADIUS = 80; // inside the 100 m camera far-plane
const MOON_RADIUS = 70;

/** Per-preset ash tuning (Task 10, spec §6): the field stays as v1 (220 @ 0.55);
 *  the dead canopy is denser + slower; the gorge is thinner ash (embers add the
 *  warmth below). Smooth — the ash-fall drift is never stepped. */
const ASH: Record<ExteriorSky, { count: number; fallMps: number }> = {
  field: { count: 220, fallMps: 0.55 }, // unchanged (spec §6)
  forest: { count: 320, fallMps: 0.38 }, // denser + slower
  gorge: { count: 180, fallMps: 0.6 }, // thinner ash; embers add the warmth below
};

/** Gorge ember tuning: a sparse warm-fleck `Points` drifting UP from the fires
 *  below (spec §6). Warm amber, faint, small — read against the ember-lit murk. */
const EMBER_COUNT = 90;
const EMBER_RISE_MPS = 0.5; // gentle upward drift
const EMBER_COLOR = 0xff7a2c;
const EMBER_TOP = 16; // recycle a risen ember back to the floor past this height

export interface ExteriorBackdrop {
  dome: Mesh;
  moon: Mesh;
  ash: Points;
  /** Sparse warm embers drifting UP — the gorge only (spec §6); undefined
   *  otherwise. Added to the zone group + ticked/freed alongside the ash. */
  embers?: Points;
  /** Unit direction from the play-space centre toward the moon disc — the key
   *  light is oriented from this so the moon reads as the scene's light source. */
  moonDir: Vector3;
  /** Drift the ash-fall down (and wrap it) + rise the embers, meters per `dtMs`. */
  update(dtMs: number): void;
  /** Free the geometries + materials (also covered by group teardown). */
  dispose(): void;
}

/** Moon world offset from play-space centre (matches the moon.position math below). */
function moonOffset(spanM: number): Vector3 {
  return new Vector3(-spanM * 0.2, MOON_RADIUS * 0.62, -MOON_RADIUS * 0.7);
}
/** Unit direction from the play-space centre TOWARD the visible moon disc. The
 *  DirectionalLight is oriented from this so the key light AGREES with the moon
 *  (or the world reads stage-lit — spec §3). Up (+y) and north (−z). */
export function moonDirection(spanM: number): Vector3 {
  return moonOffset(spanM).normalize();
}

/** Vertical dome gradient baked into vertex colours (horizon→zenith by height). */
function domeGeometry(pal: SkyPalette): BufferGeometry {
  const geo = new SphereGeometry(DOME_RADIUS, 16, 12);
  const pos = geo.getAttribute('position');
  const zenith = new Color(pal.zenith);
  const horizon = new Color(pal.horizon);
  const colors = new Float32Array(pos.count * 3);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    // t: 0 at/below the horizon, 1 at the top of the dome.
    const t = Math.max(0, Math.min(1, pos.getY(i) / DOME_RADIUS));
    tmp.copy(horizon).lerp(zenith, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/**
 * Build the backdrop for a preset. `center`/`spanM` scope the ash box to the
 * zone footprint so it falls over the play space, not off in the void.
 */
export function buildExteriorSky(
  preset: ExteriorSky,
  opts: { center?: { x: number; z: number }; spanM?: number } = {},
): ExteriorBackdrop {
  const pal = PALETTES[preset];
  const cx = opts.center?.x ?? 0;
  const cz = opts.center?.z ?? 0;
  const span = opts.spanM ?? 40;

  // --- dome: huge inward-facing sphere, unlit, never fogged ---
  const dome = new Mesh(
    domeGeometry(pal),
    new MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, side: 1 /* BackSide */ }),
  );
  dome.name = 'exterior-sky-dome';
  dome.renderOrder = -10; // behind everything
  dome.frustumCulled = false;

  // --- moon: a pale disc hung high toward the north horizon ---
  const moon = new Mesh(
    new CircleGeometry(4.5, 20),
    new MeshBasicMaterial({ color: pal.moon, fog: false, depthWrite: false }),
  );
  moon.name = 'exterior-moon';
  moon.position.copy(moonOffset(span)).add(new Vector3(cx, 0, cz)); // was moon.position.set(cx - span*0.2, ...)
  moon.lookAt(cx, 0, cz); // face the play space
  moon.renderOrder = -9;
  moon.frustumCulled = false;

  // --- ash-fall: a slow snow of grey motes over the footprint (per-preset) ---
  const ashCount = ASH[preset].count;
  const ashFallMps = ASH[preset].fallMps;
  const positions = new Float32Array(ashCount * 3);
  const top = 14; // ceiling the motes fall from (above eye level)
  for (let i = 0; i < ashCount; i++) {
    positions[i * 3] = cx + (Math.random() - 0.5) * span;
    positions[i * 3 + 1] = Math.random() * top;
    positions[i * 3 + 2] = cz + (Math.random() - 0.5) * span;
  }
  const ashGeo = new BufferGeometry();
  ashGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const ash = new Points(
    ashGeo,
    new PointsMaterial({ color: pal.ash, size: 0.07, transparent: true, opacity: 0.7, fog: false, depthWrite: false }),
  );
  ash.name = 'exterior-ash';
  ash.frustumCulled = false;

  // --- gorge embers: a sparse warm-fleck Points rising from the fires below ---
  let embers: Points | undefined;
  let emberGeo: BufferGeometry | undefined;
  if (preset === 'gorge') {
    const eArr = new Float32Array(EMBER_COUNT * 3);
    for (let i = 0; i < EMBER_COUNT; i++) {
      eArr[i * 3] = cx + (Math.random() - 0.5) * span;
      eArr[i * 3 + 1] = Math.random() * EMBER_TOP;
      eArr[i * 3 + 2] = cz + (Math.random() - 0.5) * span;
    }
    emberGeo = new BufferGeometry();
    emberGeo.setAttribute('position', new Float32BufferAttribute(eArr, 3));
    embers = new Points(
      emberGeo,
      new PointsMaterial({ color: EMBER_COLOR, size: 0.1, transparent: true, opacity: 0.8, fog: false, depthWrite: false }),
    );
    embers.name = 'exterior-embers';
    embers.frustumCulled = false;
  }

  const update = (dtMs: number): void => {
    const attr = ashGeo.getAttribute('position') as Float32BufferAttribute;
    const arr = attr.array as Float32Array;
    const drop = (dtMs / 1000) * ashFallMps;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] -= drop;
      if (arr[i] < 0) arr[i] += top; // wrap: an endless fall
    }
    attr.needsUpdate = true;
    if (emberGeo) {
      const eAttr = emberGeo.getAttribute('position') as Float32BufferAttribute;
      const eArr = eAttr.array as Float32Array;
      const rise = (dtMs / 1000) * EMBER_RISE_MPS;
      for (let i = 1; i < eArr.length; i += 3) {
        eArr[i] += rise;
        if (eArr[i] > EMBER_TOP) eArr[i] -= EMBER_TOP; // wrap: an endless rise
      }
      eAttr.needsUpdate = true;
    }
  };

  const dispose = (): void => {
    const drawables: (Mesh | Points)[] = [dome, moon, ash];
    if (embers) drawables.push(embers);
    for (const o of drawables) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial | PointsMaterial).dispose();
    }
  };

  return { dome, moon, ash, embers, moonDir: moonDirection(span), update, dispose };
}
