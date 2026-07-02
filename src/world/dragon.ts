/**
 * VHAELIS — the Flame That Lends (Task 15). The dragon staged at the summit:
 * silhouette-first, most of it lost in the 6 m fog, built from low-poly kit
 * geometry so it reads at PS1 fidelity. A WALL OF SCALES (the brow/head mass), a
 * JAW with a row of teeth, and — the star — one ~2.2 m EYE with an emissive
 * slit iris and lids that open slowly.
 *
 * `buildDragon()` returns the group plus `setEyeOpen(t)` (0 = shut, 1 = wide)
 * and `update(dt)` for a slow living shimmer. main.ts positions the group at the
 * north end of the summit, looming over the 2 m wall, and drives the eye open
 * when the lit knight approaches the flame.
 */
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { Object3D } from 'three';

/** Eye radius (m); diameter ≈ 2.2 m — the brief's "~2.2m eye". */
const R = 1.1;
/** Height of the eye's centre above the ledge floor (looms over the 2m wall). */
const EYE_Y = 3.4;

export interface Dragon {
  group: Group;
  /** 0 = lids shut over the iris, 1 = fully open. */
  setEyeOpen(t: number): void;
  /** Slow idle shimmer / breath (call each frame). */
  update(dtMs: number): void;
}

const SCALE_COLOR = 0x0c160f; // near-black scaled hide
const SCALE_EMISSIVE = 0x05120a; // the faintest inner warmth

function scaleMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: SCALE_COLOR,
    emissive: SCALE_EMISSIVE,
    emissiveIntensity: 1,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
}

export function buildDragon(): Dragon {
  const group = new Group();
  group.name = 'vhaelis';
  // Inner body bobs for the breath so `group` stays where main.ts places it.
  const body = new Group();
  group.add(body);

  // ── the wall of scales: a great dark head-mass behind and around the eye ──
  const headGeo = new IcosahedronGeometry(4.2, 1);
  const head = new Mesh(headGeo, scaleMat());
  head.scale.set(1.5, 1.15, 0.7); // a broad low brow, pressed toward the player
  head.position.set(0, EYE_Y - 0.2, -1.6);
  body.add(head);

  // Overlapping scale plates for texture near the eye (low, flat, tilted).
  const plateGeo = new BoxGeometry(1.5, 0.18, 1.1);
  for (let i = 0; i < 10; i++) {
    const plate = new Mesh(plateGeo, scaleMat());
    const a = (i / 10) * Math.PI * 2;
    plate.position.set(Math.cos(a) * 2.9, EYE_Y + Math.sin(a) * 2.4, 0.2);
    plate.rotation.set(Math.PI / 2, 0, a + 0.4);
    body.add(plate);
  }

  // A heavy brow ridge over the eye.
  const brow = new Mesh(new BoxGeometry(4.6, 0.7, 1.2), scaleMat());
  brow.position.set(0, EYE_Y + 1.5, 0.5);
  brow.rotation.z = 0.04;
  body.add(brow);

  // ── the jaw: a long angular wedge below, with a row of teeth ──────────────
  const jaw = new Mesh(new IcosahedronGeometry(3.2, 0), scaleMat());
  jaw.scale.set(1.7, 0.55, 0.8);
  jaw.position.set(0, EYE_Y - 3.1, 0.4);
  body.add(jaw);
  const toothGeo = new ConeGeometry(0.16, 0.7, 4);
  const toothMat = new MeshStandardMaterial({ color: 0xbdae8e, roughness: 0.8, flatShading: true });
  for (let i = -4; i <= 4; i++) {
    const tooth = new Mesh(toothGeo, toothMat);
    tooth.position.set(i * 0.62, EYE_Y - 2.55, 1.0);
    tooth.rotation.x = Math.PI; // point down
    body.add(tooth);
  }

  // ── the eye: the money shot ───────────────────────────────────────────────
  // Sclera: a dim amber ellipsoid.
  const sclera = new Mesh(
    new SphereGeometry(R, 20, 16),
    new MeshStandardMaterial({ color: 0x2a1c08, emissive: 0x180f04, roughness: 0.6, flatShading: true }),
  );
  sclera.scale.set(1.25, 1, 0.7);
  sclera.position.set(0, EYE_Y, 0.65);
  body.add(sclera);

  // Iris: a bright emissive amber disk on the sclera front. `irisFrontZ` is the
  // z of its foremost point — the slit and lids MUST sit in front of it.
  const irisZ = 0.65 + R * 0.62;
  const irisFrontZ = irisZ + R * 0.62 * 0.4 + 0.02; // sphere half-depth (scale.z 0.4)
  const irisMat = new MeshStandardMaterial({
    color: 0xffab3d,
    emissive: 0xff8c1a,
    emissiveIntensity: 2.0,
    roughness: 0.4,
  });
  const iris = new Mesh(new SphereGeometry(R * 0.62, 18, 14), irisMat);
  iris.scale.set(1, 1, 0.4);
  iris.position.set(0, EYE_Y, irisZ);
  body.add(iris);

  // Slit pupil: a DARK vertical slit over the bright iris — the thing that makes
  // it read as a reptile's eye rather than a sun. Faint magma-red core only.
  const pupilMat = new MeshStandardMaterial({
    color: 0x140500,
    emissive: 0x2a0a00,
    emissiveIntensity: 0.5,
    roughness: 0.8,
  });
  const pupil = new Mesh(new BoxGeometry(0.16, R * 1.55, 0.06), pupilMat);
  pupil.position.set(0, EYE_Y, irisFrontZ + 0.03);
  body.add(pupil);

  // Lids: two dark scale caps that meet over the iris when shut and retract.
  const lidGeo = new BoxGeometry(R * 2.8, R * 1.35, 0.35);
  const upperLid = new Mesh(lidGeo, scaleMat());
  const lowerLid = new Mesh(lidGeo, scaleMat());
  const lidZ = irisFrontZ + 0.12;
  upperLid.position.set(0, EYE_Y, lidZ);
  lowerLid.position.set(0, EYE_Y, lidZ);
  body.add(upperLid, lowerLid);

  let openT = 0;
  const setEyeOpen = (t: number): void => {
    openT = Math.min(1, Math.max(0, t));
    // Lids meet at the centre at t=0, retract by ~one eye-height at t=1.
    upperLid.position.y = EYE_Y + R * 0.5 + openT * R * 1.15;
    lowerLid.position.y = EYE_Y - R * 0.5 - openT * R * 1.15;
    irisMat.emissiveIntensity = 0.5 + openT * 2.0; // brighter as it wakes
    // The slit widens a touch as the eye opens (a waking pupil).
    pupil.scale.x = 0.6 + openT * 0.7;
  };
  setEyeOpen(0);

  let time = 0;
  const update = (dtMs: number): void => {
    time += dtMs;
    // A slow breath: the head-mass rises a few centimetres (body-local, so it
    // never fights main.ts's placement of the outer group).
    body.position.y = Math.sin(time * 0.0006) * 0.12;
    // Iris flicker only once awake.
    if (openT > 0.05) {
      const flick = 1 + Math.sin(time * 0.004) * 0.12;
      irisMat.emissiveIntensity = (0.6 + openT * 2.4) * flick;
    }
  };

  return { group, setEyeOpen, update };
}

/** Traverse helper: dispose a dragon group's geometry + materials on teardown. */
export function disposeDragon(group: Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m.dispose();
  });
}
