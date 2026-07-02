/**
 * The Second Vigil (Task 16) — NG+ zone assembly.
 *
 * `applyNgPlus` is the PURE half: it folds a zone's `ngPlus` variant (zoneDef.ts)
 * onto its base def and returns a NEW def, never mutating the input. The
 * satellite arrays (enemies/props/lights/doors/ambience) REPLACE the base array
 * when the variant sets them (the enemy remixes from T11/T12/T15); `addedLore`
 * is CONCATENATED onto the base lore and deduped by id — which is what makes the
 * merge idempotent (a second pass finds the ngOnly ids already present and drops
 * the re-add), so a THIRD Vigil sees exactly the same world as the second.
 *
 * The renderer-side half of NG+ — the anomalies (content/anomalies.ts) — is NOT
 * here: those mutate the built three.js scene, so ZoneBuilder applies them as a
 * post-build hook (ZoneManager passes them in NG+ only). This module stays a
 * pure data merge so it can be unit-tested headless.
 */
import type { LoreSpot, ZoneDef } from './zoneDef';

/** Keep the first LoreSpot per id (base entries win over a duplicate add). */
function dedupeLore(spots: LoreSpot[]): LoreSpot[] {
  const seen = new Set<string>();
  const out: LoreSpot[] = [];
  for (const spot of spots) {
    if (seen.has(spot.id)) continue;
    seen.add(spot.id);
    out.push(spot);
  }
  return out;
}

/**
 * Merge a zone's NG+ variant onto its base def (pure). Zones without an
 * `ngPlus` variant pass through unchanged. Idempotent: `applyNgPlus` of an
 * already-merged def equals the merged def.
 */
export function applyNgPlus(def: ZoneDef): ZoneDef {
  const ng = def.ngPlus;
  if (!ng) return def;
  return {
    ...def,
    enemies: ng.enemies ?? def.enemies,
    props: ng.props ?? def.props,
    lights: ng.lights ?? def.lights,
    doors: ng.doors ?? def.doors,
    ambience: ng.ambience ?? def.ambience,
    lore: ng.addedLore ? dedupeLore([...def.lore, ...ng.addedLore]) : def.lore,
  };
}
