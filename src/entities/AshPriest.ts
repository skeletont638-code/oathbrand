/**
 * The Ash-Priest (Task 13) — the one living voice left in Vael. A static,
 * robed figure who keeps the graves and remembers the player; NOT an Enemy
 * (no FSM, no combat, no collider), just a thing you SPEAK to. A hollow player
 * can still speak to him — he sees everyone.
 *
 * RENDER APPROACH: he reuses the kit's `statue-knight.glb` (a hooded,
 * pedestal-standing silhouette — close enough to a cowled priest at PS1
 * fidelity) rather than a bespoke mesh. Each instance clones the shared
 * template and swaps in its OWN darkened, ashen-tinted material (the kit stone
 * is too bright to read as a robed figure), then runs it through the same PS1
 * material patch the zones use so he sits in the same crunchy, affine-warped
 * world. A future task can drop a purpose-built robed GLB in behind this class
 * without touching the placement data or the SPEAK wiring.
 *
 * Placements live here (not in the zone defs) precisely because the retexture
 * needs a separate material — folding him into ZoneBuilder's merged-static prop
 * path would repaint him in plain kit stone. main.ts spawns/clears these per
 * zone exactly as it does enemies.
 */
import { Color, Group, Mesh } from 'three';
import type { Material, MeshStandardMaterial } from 'three';
import { NearestFilter } from 'three';
import { patchMaterial } from '../ps1/patchMaterial';
import type { ZoneId } from '../content/types';
import type { DialogueId } from '../content/dialogue';
import type { Interactable } from '../player/Interactor';
import type { GridPos } from '../world/zoneDef';

/** Where an Ash-Priest stands, and which encounter he plays when spoken to. */
export interface AshPriestPlacement {
  /** Unique interactable id (game-wide). */
  id: string;
  zone: ZoneId;
  /** Grid cell [row, col] — off the walk line, never blocking a path. */
  at: GridPos;
  /** Facing yaw (radians). */
  rotY: number;
  dialogueId: DialogueId;
}

/**
 * The placements. Encounters 1 and 2 sit in built castle zones and wire up now;
 * encounter 3's summit, and the two Greater Vael Drop-1 stops (`gate-fields`
 * threshold + `pilgrims-descent` final word), are REGISTERED here — their
 * dialogue is authored in dialogue.ts (Task 8) — but nothing spawns them until
 * the zone exists. `ashPriestsIn` returns nothing for an unbuilt zone because
 * main.ts only spawns for the zone it has loaded; the exact cell + facing of
 * the two gv stops are the zone tasks' (9–12) to finalise against real floor.
 */
export const ASH_PRIESTS: AshPriestPlacement[] = [
  // Ashen Gate: tucked against the west wall just south of the player's waking
  // spot [2,3] — the first face you see, well clear of the vista row and the
  // walk to the gate.
  { id: 'ashpriest-gate', zone: 'ashen-gate', at: [3, 2], rotY: Math.PI * 0.5, dialogueId: 'ashpriest-1' },
  // Ramparts: the south-west corner by the banner post and the entry stair,
  // off the archers' firing line down the north walk.
  { id: 'ashpriest-ramparts', zone: 'ramparts', at: [5, 2], rotY: Math.PI * 0.25, dialogueId: 'ashpriest-2' },
  // Summit stair (T15): he stands at the top of the stair, the crown-flame and
  // the sleeping dragon at your back as he speaks — his last word varies by the
  // ending the run is bound for (dialogue.ts ASHPRIEST_3_FINAL).
  { id: 'ashpriest-summit', zone: 'summit', at: [6, 7], rotY: Math.PI * 1.5, dialogueId: 'ashpriest-3' },
  // Greater Vael Drop 1 (Task 8), zones built in Tasks 9–12. The Ash-Priest is
  // the ONE voice past the gate; he keeps the threshold of the Fields (welcome
  // + warning) and stands at the foot of the Pilgrim's Descent for his final
  // Drop-1 word. Cells are off-path defaults; the zone task pins them to real floor.
  { id: 'ashpriest-gv-fields', zone: 'gate-fields', at: [3, 2], rotY: Math.PI * 0.5, dialogueId: 'ashpriest-gv-fields' },
  { id: 'ashpriest-gv-descent', zone: 'pilgrims-descent', at: [2, 3], rotY: Math.PI * 0.5, dialogueId: 'ashpriest-gv-descent' },
];

/** Placements standing in `zone`. */
export function ashPriestsIn(zone: ZoneId): AshPriestPlacement[] {
  return ASH_PRIESTS.filter((p) => p.zone === zone);
}

/** Ashen robe tint multiplied into the kit stone — cold, dark, sooted. */
const ASH_TINT = new Color(0x3a3a44);

/** A placed, retextured Ash-Priest ready to add to the scene. */
export class AshPriest {
  readonly root: Group;
  readonly id: string;
  readonly dialogueId: DialogueId;
  private readonly x: number;
  private readonly z: number;
  private readonly materials: Material[] = [];

  constructor(template: Group, placement: AshPriestPlacement, cellM: number) {
    this.id = placement.id;
    this.dialogueId = placement.dialogueId;
    const [row, col] = placement.at;
    this.x = (col + 0.5) * cellM;
    this.z = (row + 0.5) * cellM;

    // Clone the shared template, then give this instance its OWN darkened
    // material so retexturing never touches the cached kit piece.
    this.root = template.clone(true);
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const mat = mesh.material.clone() as MeshStandardMaterial;
      mat.color.multiply(ASH_TINT);
      mat.roughness = 0.95;
      mat.metalness = 0;
      if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
      if (mat.map) {
        mat.map.magFilter = NearestFilter;
        mat.map.minFilter = NearestFilter;
        mat.map.generateMipmaps = false;
        mat.map.needsUpdate = true;
      }
      patchMaterial(mat);
      mesh.material = mat;
      this.materials.push(mat);
    });
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = placement.rotY;
    this.root.name = `ashpriest:${placement.id}`;
  }

  /** The context-action target: SPEAK, at the priest's feet. */
  interactable(): Interactable {
    return { id: this.id, verb: 'SPEAK', x: this.x, z: this.z, label: 'THE ASH-PRIEST' };
  }

  /** Free this instance's cloned geometry/materials on zone exit. */
  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.materials) {
      (m as MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  }
}
