/**
 * ANOMALIES — the Second Vigil's "Exit 8" grammar (Task 16).
 *
 * On a NG+ run every zone is subtly WRONG in exactly one or two ways: a statue
 * that has turned to watch you, a second moon, a banner already burning, the
 * throne occupied, a wraith that stands and stares but never comes. None of it
 * changes what you can do — it changes what you understand. Each anomaly is a
 * single, screenshot-able alteration of the BUILT three.js scene, applied by
 * the ZoneBuilder post-build hook and ONLY on a Second Vigil (save.ngPlus).
 *
 * They live here, not in the ZoneDef, because they mutate meshes/lights (the
 * built world) rather than pure authoring data — and because the base game must
 * be able to build every zone with none of them present (regression-safe). All
 * added objects are children of `built.group`, so ZoneManager's zone teardown
 * disposes them with the rest of the zone (Mesh + PointLight only — no Points/
 * Sprites, which that teardown would leak).
 *
 * VOICE: quiet dread, never a jump-scare. If the player has to look twice, it
 * worked.
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import type { ZoneId } from './types';
import type { BuiltZone } from '../world/ZoneBuilder';
import { GREAT_HALL } from './zones/greatHall';

export type AnomalyId =
  | 'gate-banner-burning'
  | 'gate-herald-gone'
  | 'gate-torii-inverted'
  | 'hall-statue-turned'
  | 'hall-extra-door'
  | 'hall-kneeling-armor'
  | 'undercroft-still-wraith'
  | 'ramparts-second-moon'
  | 'ramparts-ghost-banners'
  | 'throne-ash-figure'
  | 'throne-black-torch'
  | 'summit-blue-flame';

/** One Second-Vigil alteration of a built zone. `apply` mutates `built.group`
 *  (or its `lore`/`lights`) in place; it must be idempotent-safe per build. */
export interface Anomaly {
  id: AnomalyId;
  zone: ZoneId;
  apply(built: BuiltZone): void;
}

// ─── primitive helpers (no kit assets — anomalies get `built` only) ──────────

/** World-space center of a grid cell in the built zone. */
function cell(built: BuiltZone, row: number, col: number): [number, number] {
  return [(col + 0.5) * built.cellM, (row + 0.5) * built.cellM];
}

/** A crude standing/kneeling figure (plinth-less body + head) from boxes. */
function figure(color: number, height: number, opts: { emissive?: number; opacity?: number } = {}): Group {
  const g = new Group();
  const mat = new MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0.05,
    emissive: opts.emissive ?? 0x000000,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
  });
  const body = new Mesh(new BoxGeometry(0.5, height, 0.32), mat);
  body.position.y = height / 2;
  const head = new Mesh(new SphereGeometry(0.16, 8, 6), mat);
  head.position.y = height + 0.12;
  g.add(body, head);
  return g;
}

/** The nearest built PointLight to a cell (for retinting a specific torch). */
function nearestLight(built: BuiltZone, row: number, col: number): PointLight | undefined {
  const [x, z] = cell(built, row, col);
  let best: PointLight | undefined;
  let bestD = Infinity;
  for (const l of built.lights) {
    const d = (l.position.x - x) ** 2 + (l.position.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// ─── the twelve ──────────────────────────────────────────────────────────────

export const ANOMALIES: Anomaly[] = [
  // ── THE ASHEN GATE ──────────────────────────────────────────────────────
  {
    // A war-banner on the north wall, already alight — a fire that answers no one.
    // No NEW PointLight: ashen-gate is deliberately trimmed to exactly 4 torches
    // (its zone light budget — see ashenGate.ts), so we retint the nearest existing
    // torch toward the burning-banner orange instead of adding a 5th light. Same
    // move as throne-black-torch below — recolor a built light, don't grow the count.
    id: 'gate-banner-burning',
    zone: 'ashen-gate',
    apply(built) {
      const [x, z] = cell(built, 1, 3);
      const cloth = new Mesh(
        new PlaneGeometry(0.9, 1.7),
        new MeshBasicMaterial({ color: 0xff7a2a, fog: true, transparent: true, opacity: 0.92 }),
      );
      cloth.position.set(x, 1.5, z + 0.4);
      // Pull the nearest torch toward the burning-cloth orange and bump it a touch,
      // so the banner reads as fire-lit. ZoneManager captures this intensity as the
      // flicker base, so the retinted flame still breathes like the others.
      const light = nearestLight(built, 1, 3);
      if (light) {
        light.color.lerp(new Color(0xff6a20), 0.6);
        light.intensity += 3;
      }
      built.group.add(cloth);
    },
  },
  {
    // The herald's remains are GONE — the inscription you read last Vigil is not
    // here to read. She was never here (ng-edda-lie). Subtle: no mesh, an absence.
    id: 'gate-herald-gone',
    zone: 'ashen-gate',
    apply(built) {
      const i = built.lore.findIndex((l) => l.spot.id === 'herald-corpse');
      if (i >= 0) built.lore.splice(i, 1);
    },
  },
  {
    // A royal gate standing in the courtyard where none was — and standing wrong,
    // its lintel at your feet. The torii, inverted.
    id: 'gate-torii-inverted',
    zone: 'ashen-gate',
    apply(built) {
      const [x, z] = cell(built, 3, 5);
      const stone = new MeshStandardMaterial({ color: 0x3a2b22, roughness: 1 });
      const torii = new Group();
      const postL = new Mesh(new BoxGeometry(0.22, 2.2, 0.22), stone);
      postL.position.set(-0.7, 1.1, 0);
      const postR = postL.clone();
      postR.position.set(0.7, 1.1, 0);
      // The crossbeams that should crown it, dragged down to the ground instead.
      const lintel = new Mesh(new BoxGeometry(2.0, 0.26, 0.3), stone);
      lintel.position.set(0, 0.13, 0);
      const tie = new Mesh(new BoxGeometry(1.6, 0.18, 0.24), stone);
      tie.position.set(0, 0.5, 0);
      torii.add(postL, postR, lintel, tie);
      torii.position.set(x, 0, z);
      torii.rotation.y = 0.12;
      built.group.add(torii);
    },
  },

  // ── THE GREAT HALL ──────────────────────────────────────────────────────
  {
    // The hall statue has turned from the wall to face the door you came in by.
    // Its cell is DERIVED from the base statue prop (greatHall.ts) so the
    // illusion always overlays the real statue — a prop move can never desync
    // them into two statues a cell apart (Task 9 moved it [2,13]→[1,13] and the
    // old hardcoded cell here did exactly that; ngplus.test.ts pins the pair).
    id: 'hall-statue-turned',
    zone: 'great-hall',
    apply(built) {
      const statue = GREAT_HALL.props.find((p) => p.kind === 'statue-knight');
      if (!statue) return; // no base statue to have "turned" (the ngplus test guards its existence)
      const [x, z] = cell(built, statue.at[0], statue.at[1]);
      const stone = figure(0x6d6a63, 1.7);
      const plinth = new Mesh(
        new BoxGeometry(0.7, 0.4, 0.7),
        new MeshStandardMaterial({ color: 0x565049, roughness: 1 }),
      );
      plinth.position.y = 0.2;
      stone.add(plinth);
      stone.position.set(x, 0.4, z);
      stone.rotation.y = Math.PI; // faces south, back down the nave toward the entry
      built.group.add(stone);
    },
  },
  {
    // A doorway on the north wall that was never a door — recessed, dark, dead.
    id: 'hall-extra-door',
    zone: 'great-hall',
    apply(built) {
      const [x, z] = cell(built, 1, 9);
      const frame = new Group();
      const jamb = new MeshStandardMaterial({ color: 0x2a2622, roughness: 1 });
      const dark = new Mesh(
        new PlaneGeometry(1.1, 2.0),
        new MeshBasicMaterial({ color: 0x050506, fog: false }),
      );
      dark.position.set(0, 1.0, 0.01);
      const left = new Mesh(new BoxGeometry(0.16, 2.2, 0.16), jamb);
      left.position.set(-0.63, 1.1, 0);
      const right = left.clone();
      right.position.set(0.63, 1.1, 0);
      const top = new Mesh(new BoxGeometry(1.4, 0.2, 0.16), jamb);
      top.position.set(0, 2.1, 0);
      frame.add(dark, left, right, top);
      frame.position.set(x, 0, z - 0.9); // flush on the north wall face
      built.group.add(frame);
    },
  },
  {
    // Rows of empty armor, kneeling toward the banner chamber where none knelt before.
    id: 'hall-kneeling-armor',
    zone: 'great-hall',
    apply(built) {
      for (const [row, col] of [
        [8, 4],
        [8, 6],
        [8, 12],
        [8, 14],
      ] as const) {
        const [x, z] = cell(built, row, col);
        const armor = figure(0x40444c, 1.0, { emissive: 0x05060a }); // squat = kneeling
        armor.position.set(x, 0, z);
        armor.rotation.y = 0; // faces north, up the nave toward the banner
        built.group.add(armor);
      }
    },
  },

  // ── THE UNDERCROFT ────────────────────────────────────────────────────────
  {
    // A wraith in the LIT west half, upright, watching — and it never comes.
    id: 'undercroft-still-wraith',
    zone: 'undercroft',
    apply(built) {
      const [x, z] = cell(built, 1, 3);
      const wraith = figure(0xbfe4ff, 1.7, { emissive: 0x2a4a66, opacity: 0.5 });
      wraith.position.set(x, 0, z);
      wraith.rotation.y = Math.PI * 0.75; // turned to face the arrival stair
      built.group.add(wraith);
    },
  },

  // ── THE RAMPARTS ────────────────────────────────────────────────────────
  {
    // A second moon, hung over the parapet beside the first.
    id: 'ramparts-second-moon',
    zone: 'ramparts',
    apply(built) {
      const [x] = cell(built, 6, 11);
      const moon = new Mesh(
        new SphereGeometry(1.5, 16, 12),
        new MeshBasicMaterial({ color: 0xb9c4d6, fog: false }), // punches through the ash-haze
      );
      moon.position.set(x, 12.5, 22); // far beyond the south parapet, high
      built.group.add(moon);
    },
  },
  {
    // Pale banners flicker where the war-banners hang — the past bleeding through.
    id: 'ramparts-ghost-banners',
    zone: 'ramparts',
    apply(built) {
      for (const col of [5, 11, 17]) {
        const [x, z] = cell(built, 5, col);
        const ghost = new Mesh(
          new PlaneGeometry(0.85, 1.5),
          new MeshBasicMaterial({ color: 0xdfe9ff, fog: true, transparent: true, opacity: 0.28 }),
        );
        ghost.position.set(x, 2.4, z);
        built.group.add(ghost);
      }
    },
  },

  // ── THE THRONE ────────────────────────────────────────────────────────────
  {
    // The dead throne of Vael is occupied — an ash-grey figure sits the seat.
    id: 'throne-ash-figure',
    zone: 'throne',
    apply(built) {
      const [x, z] = cell(built, 1, 4);
      const seated = figure(0x8f8a82, 1.0, { emissive: 0x0a0a08 });
      seated.position.set(x, 0.6, z + 0.15); // sat on the plinth, facing the arena
      built.group.add(seated);
    },
  },
  {
    // One of the four arena braziers burns black — a cold violet where fire should be.
    id: 'throne-black-torch',
    zone: 'throne',
    apply(built) {
      const light = nearestLight(built, 2, 1);
      if (light) {
        light.color.setHex(0x1a0a2a);
        light.intensity = 1.2; // ZoneManager captures this as the flicker base
      }
      const [x, z] = cell(built, 2, 1);
      const blackFlame = new Mesh(
        new ConeGeometry(0.18, 0.5, 8),
        new MeshBasicMaterial({ color: 0x120720, fog: true }),
      );
      blackFlame.position.set(x + 0.7, 1.7, z);
      built.group.add(blackFlame);
    },
  },

  // ── THE SUMMIT ──────────────────────────────────────────────────────────
  {
    // The offering-flame is already lit — and it burns cold blue (main.ts also
    // renders the brazier blue in NG+; this is the ring of cold light around it).
    id: 'summit-blue-flame',
    zone: 'summit',
    apply(built) {
      const [x, z] = cell(built, 2, 4);
      const halo = new Mesh(
        new SphereGeometry(0.5, 12, 10),
        new MeshBasicMaterial({ color: 0x4f8cff, fog: true, transparent: true, opacity: 0.35 }),
      );
      halo.position.set(x, 1.05, z);
      const cold = new PointLight(0x3f7bff, 3.5, 8);
      cold.position.set(x, 1.3, z);
      cold.castShadow = false;
      built.group.add(halo, cold);
    },
  },
];

/** The anomalies that alter `zone` on a Second Vigil (registry is authoritative). */
export function anomaliesForZone(zone: ZoneId): Anomaly[] {
  return ANOMALIES.filter((a) => a.zone === zone);
}
