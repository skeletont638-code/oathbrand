# Task 7 Report — The Sunken Chapel (Ashen Forest N)

**Status:** COMPLETE. Branch `feat/world` (built on HEAD b216849).
**Commit:** `feat(content): the sunken chapel — nave above, crypt below, the queen walked here`

## What shipped
Two new dread interiors off the Ashen Forest road, plus the forest entry + a chapel silhouette that reads from outside.

### `chapel-nave` (`src/content/zones/chapelNave.ts`) — 7×11
- Half-collapsed nave. Raised altar END via `heightGrid` (dais rows 0–2 band 1, nave band 0; row2↔row3 = walkable ramp, `stairs` prop at [3,3] the visible treads — keepChapel mechanism A, wall-banding applied).
- Pew rows = 6 crates flank the aisle (cols 1/5); row 6 left bare + `rubble` at [6,1]/[6,5] + a fallen block [2,5] = the collapse read.
- **Torches:** 2 LIT (`torches` at [1,1]/[1,5], flanking the altar) + **1 UNLIT torch PROP** at [8,1] (see choice below).
- **Scene 5 / queen's-walk echo:** central aisle cells **[4,3],[5,3],[6,3],[7,3]** (4 contiguous, col 3) kept prop/enemy-free (test-locked). Stairs treads sit just N at [3,3], chancel stone just S at [8,3].
- 2 inscriptions `act2-nave-a` ([2,1]) / `act2-nave-b` ([8,3]) — Act II, Queen Maren's WALK (forward-dread, straight-apostrophe/em-dash style matching act2-chapel-a/b).
- `Crypt Stair` DOWN to crypt (gate '2' [8,6]); `Chapel Door` from forest (gate '1' [10,3]). Both gateDoors declared here (one side per edge). No base enemies; NG+ adds 1 wraith.

### `chapel-crypt` (`src/content/zones/chapelCrypt.ts`) — 6×7
- `dreadInterior`, near-black `ambientFloor: 0.06` + `keyLightIntensity: 0` (Undercroft wraith-showcase precedent — torches only at the stair-foot [1,1]/[1,4], far end black).
- 2 torches, **1 wraith** [4,3] (dark corner), bones `scatter` ×4, tomb `pillar` [2,3] + `rubble` [4,4], 1 inscription `act2-crypt-a` [2,2] (what the queen left). NG+ adds a 2nd wraith.

### Entry / registration / silhouette
- `ashenForestN.ts`: new gate cell **'4' at [0,3]** (N wall) + `af-to-chapel` door (unlocked, pair `chapel-door`) + off-grid `chapel-shell` prop at [-1,3]. NO contract cell disturbed (spawn/spoke-door/banner/hounds/lore/AF-beats/hag-threshold all verified unchanged by test).
- New procedural `chapelShellGeometry` (`exteriorProps.ts`, ~44 tris: roofless stone nave + pitched gable + leaning cross) registered as `chapel-shell` in `ZoneBuilder.PROCEDURAL_PROPS`. CC0 note added to LICENSES.md. Chose a bespoke minimal variant over reusing `tower-shell` (an octagonal crenellated TOWER would misread as a tower, not a chapel — brief permits "reuse or minimal variant").
- `types.ts` (+2 ZoneId, append-only), `zones/index.ts` (+2 registered).

## Pins bumped (brief's "zones 16→18, lore +3")
- `zones.test.ts`: zone count 16→18 (+ new "registers the Sunken Chapel" test); `forest.doors` 1→2; new `describe('The Sunken Chapel')` block (Chapel Door + Crypt Stair pairing, contract-cell guard, dread-interior/altar-ramp/torch checks, echo-cell reservation, crypt wraith/bones, labelled DoorInstances).
- `lore.test.ts`: base 58→61, total 66→69.

## Concerns / choices
- **Unlit-torch choice:** the `torches` kit is ALWAYS lit (bracket + emissive flame + pooled light) — it has no no-light field. `torch.glb` is a bracket ONLY (flame/light added by the kit), so placing `{kind:'torch'}` in `props` gives a genuine UNLIT bracket with NO kit extension. Caveat: props seat at cell CENTRE (no wall-face offset like `torches`), so the unlit bracket stands ~1 m proud of the W wall rather than flush — reads as a dead sconce at PS1 fidelity in a dark ruin, but an in-game eyeball by the owner is worth it. Went with 2 lit + 1 unlit (not 3 lit) since the kit supports it cleanly.
- **Echo cells reserved:** [4,3],[5,3],[6,3],[7,3] (col 3, contiguous) — test-enforced clear for Task 9's queen's-walk echo.
- **In-browser eyeball deferred:** sandbox kills the headless browser; substituted a headless draw-call count (nave 10, crypt 7; 2 lights each) + `vite build` OK. Owner PS1/HD eyeball recommended.

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → **56 files, 1074 passed** (0 fail). Includes reachability green (forest→nave→crypt), all prior tests, +9 new (7 chapel structural, 2 chapel-shell geometry).
- `npx vite build` → built OK (pre-existing chunk-size warning only).
- Draw calls: nave 10 / crypt 7 (≤100 budget); torches 2/2 (≤6); tris(chapel-shell) ≤200, grounded, UV'd, deterministic.

## Files
- New: `src/content/zones/chapelNave.ts`, `src/content/zones/chapelCrypt.ts`
- Modified: `src/content/zones/ashenForestN.ts`, `src/content/zones/index.ts`, `src/content/types.ts`, `src/content/lore.ts`, `src/world/exteriorProps.ts`, `src/world/ZoneBuilder.ts`, `assets/LICENSES.md`, `src/content/__tests__/zones.test.ts`, `src/content/__tests__/lore.test.ts`, `src/world/__tests__/exteriorProps.test.ts`
