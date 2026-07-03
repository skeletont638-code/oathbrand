/**
 * Task 8 (Greater Vael Drop 1) — the tithe visions, the Hag vision, and the
 * Ash-Priest's Drop-1 voice. Pure content coverage: the four banner memories +
 * the standalone `GV_VISION_HAG` share the v1 Second-Vigil grammar (open on ash
 * 0.82, flood colour toward 0, SNAP back to ash), every gv vision id is unique
 * game-wide, and the two new Ash-Priest sequences are his (one-voice rule) and
 * static. The `VISIONS`↔banner-zone bijection itself is enforced in
 * engine/__tests__/visions.test.ts (its BANNER_ZONES table carries the four).
 */
import { describe, it, expect } from 'vitest';
import { VISIONS, GV_VISION_HAG, visionForZone } from '../visions';
import type { VisionDef } from '../../engine/VisionPlayer';
import { DIALOGUE, dialogueSequence, SPEAKER_ASH_PRIEST } from '../dialogue';

/** The ash the memory opens on and snaps back to (the 4-embers-lost ramp). */
const ASH = 0.82;

/** The four Greater Vael banner zones, in the tithe-tragedy order. */
const GV_BANNER_ZONES = [
  'gate-fields',
  'ashen-forest-n',
  'cinder-village',
  'pilgrims-descent',
] as const;

/** The five gv visions: four banners + the ledger-bargain Hag vision. */
const gvVisions = (): VisionDef[] => [
  ...GV_BANNER_ZONES.map((z) => visionForZone(z)!),
  GV_VISION_HAG,
];

describe('Greater Vael visions (Task 8)', () => {
  it('authors a vision for each of the four gv banner zones', () => {
    for (const z of GV_BANNER_ZONES) {
      expect(visionForZone(z), `vision for ${z}`).toBeDefined();
    }
  });

  it('the Hag vision id matches the ledger-bargain seam string exactly', () => {
    // main.ts applyHagBoon('play-vision') and hagBargain.ts both name this id.
    expect(GV_VISION_HAG.id).toBe('gv-vision-hag');
  });

  it('every gv vision id is unique game-wide (banners + hag + v1 castle)', () => {
    const ids = [...Object.values(VISIONS).map((v) => v.id), GV_VISION_HAG.id];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each gv vision opens on ash 0.82 and its last step snaps back to 0.82', () => {
    for (const v of gvVisions()) {
      expect(v.steps[0].desatTo, `${v.id} opens on ash`).toBe(ASH);
      expect(v.steps.at(-1)!.desatTo, `${v.id} snaps to ash`).toBe(ASH);
    }
  });

  it('each gv vision floods to full colour (min desat reaches 0) between the ends', () => {
    for (const v of gvVisions()) {
      const desats = v.steps.map((s) => s.desatTo).filter((d): d is number => d !== undefined);
      expect(Math.min(...desats), `${v.id} reaches full colour`).toBeCloseTo(0, 5);
    }
  });

  it('every gv step waits a positive time and every caption is a real one-liner', () => {
    for (const v of gvVisions()) {
      for (const step of v.steps) {
        expect(step.waitMs, `${v.id} waitMs`).toBeGreaterThan(0);
        if (step.caption !== undefined) {
          expect(step.caption.trim().length).toBeGreaterThan(0);
          expect(step.caption, `${v.id} one-line caption`).not.toContain('\n');
        }
      }
      expect(v.steps.some((s) => s.caption), `${v.id} carries a litany beat`).toBe(true);
    }
  });
});

describe('Greater Vael Ash-Priest voice (Task 8)', () => {
  const gvIds = ['ashpriest-gv-fields', 'ashpriest-gv-descent'] as const;

  it('both gv sequences are static, non-empty, and spoken ONLY by the Ash-Priest', () => {
    for (const id of gvIds) {
      const lines = DIALOGUE[id];
      expect(lines.length, `${id} length`).toBeGreaterThanOrEqual(3);
      for (const l of lines) {
        expect(l.speaker, `${id} one-voice rule`).toBe(SPEAKER_ASH_PRIEST);
        expect(l.text.trim().length).toBeGreaterThan(0);
      }
      // Static (no ending-track branch): dialogueSequence returns them verbatim.
      expect(dialogueSequence(id, new Set(), false)).toEqual(lines);
    }
  });
});
