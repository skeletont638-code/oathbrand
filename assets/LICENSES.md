# Asset licenses

Every file under `assets/` is CC0 (Creative Commons Zero 1.0,
<https://creativecommons.org/publicdomain/zero/1.0/>) and was verified against
the license file/page of its source pack at fetch time. **No file enters
`assets/` without a row in this manifest.** Raw packs are cached (gitignored)
in `.assets-cache/` by `scripts/fetch-assets.sh`; only the curated, processed
subset below is tracked.

| Source pack | Author | URL (pinned) | License | Files taken |
|---|---|---|---|---|
| KayKit Dungeon Remastered 1.0 | Kay Lousberg (kaylousberg.com) | <https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0> @ `b0ca9bd` (LICENSE.txt: CC0) | CC0 | `kit/wall.glb` (wall), `kit/wall-door.glb` (wall_doorway), `kit/wall-arch.glb` (wall_arched), `kit/floor.glb` (floor_tile_large), `kit/stairs.glb` (stairs), `kit/pillar.glb` (pillar), `kit/banner.glb` (banner_red), `kit/torch.glb` (torch_mounted), `kit/crate.glb` (box_large), `kit/rubble.glb` (rubble_half, recentered), `kit/gate.glb` (wall_gated); composites below; `tex/dungeon_texture.png` (atlas, processed) |
| KayKit Character Pack: Skeletons 1.0 | Kay Lousberg (kaylousberg.com) | <https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0> @ `15b62b9` (LICENSE.txt: CC0) | CC0 | `kit/skeleton-warrior.glb` (Skeleton_Warrior), `kit/skeleton-archer.glb` (Skeleton_Rogue — the pack's crossbow/ranged unit), `tex/skeleton_texture.png` (atlas, processed). 95 animation clips embedded per model. |
| Crown (single model, poly.pizza) | Quaternius (quaternius.com) | <https://poly.pizza/m/i0PZVuVlYv> (page states CC0), GLB sha256 `c2b598cf…c68e88` | CC0 | `kit/crown.glb` (normalized to 0.45 m, grounded, materials palette-darkened) |
| Kenney "RPG Audio" 1.0 | Kenney Vleugels (kenney.nl) | <https://kenney.nl/assets/rpg-audio> — zip sha256 `6dbeaf85…75f38b` (bundled `License.txt`: CC0) | CC0 | `audio/swing.ogg` (`Audio/knifeSlice.ogg`, sha256 `4cd96dc6…5ac5e54f`), `audio/door.ogg` (`Audio/doorOpen_1.ogg`, sha256 `4ab93bab…e5bb2a0b`) |
| Kenney "Impact Sounds" 1.0 | Kenney Vleugels (kenney.nl) | <https://kenney.nl/assets/impact-sounds> — zip sha256 `029d734a…c5de77f8` (bundled `License.txt`: CC0) | CC0 | `audio/hit.ogg` (`Audio/impactWood_heavy_000.ogg`, sha256 `15ff8233…a9927f3d`) |
| "Loopable Dungeon Ambience" (OpenGameArt) | JaggedStone | <https://opengameart.org/content/loopable-dungeon-ambience> (page license: CC0) | CC0 | `audio/amb-dungeon.ogg` (`dungeon_ambient_1_0.ogg`, sha256 `df491823…3b70e6e`) |
| "Wind Whoosh Loop" (OpenGameArt) | SketchMan3 | <https://opengameart.org/content/wind-whoosh-loop> (page license: CC0) | CC0 | `audio/amb-wind.ogg` (`wind woosh loop.ogg`, sha256 `0cfdbd3f…c191dac`) |
| "Derelict" (OpenGameArt, from the "CC0 Dark Music" collection) | northivanastan | <https://opengameart.org/content/derelict> (page license: CC0; collection <https://opengameart.org/content/cc0-dark-music>) | CC0 | `audio/amb-dark.ogg` (`derelict.ogg`, sha256 `5d097b75…48015ce`) |
| "Battle Sound Effects" (OpenGameArt) | Ogrebane | <https://opengameart.org/content/battle-sound-effects> — zip sha256 `44e3d26b…de4f4c05`; page multi-licensed **CC0** / CC-BY 3.0 / CC-BY-SA 3.0 / GPL 2.0 / GPL 3.0 — **used under CC0** | CC0 (selected) | `audio/bow.wav` (`battle_sound_effects/Bow.wav`, sha256 `0dc8cf13…5b9f3e3`) |
| AmbientCG (CC0 texture library) | ambientCG (Lennart Demes) | <https://ambientcg.com> — assets CC0 1.0: Ground037, Bark012, Rock030, Leather011, Fabric030 (`_1K-JPG` Color maps) | CC0 | `tex/ground-dirt.png`, `tex/bark.png`, `tex/rock.png`, `tex/hound-hide.png`, `tex/kneeler-cloth.png` — each resized to 128 px and 5-bit posterized by `scripts/downsample-textures.py` (≤~8 KB); ground-dirt/rock are palette-darkened standalone albedos, while bark, hound-hide, and kneeler-cloth are desaturated high-key greyscale detail maps (Task 7/8 — each multiplied by a tint that supplies the hue: bark × the forest vertex tints, hound-hide × HOUND_TINT, kneeler-cloth × KNEELER_TINT — high-key so the multiply modulates ~×0.9 without double-darkening the already-dark tints). Standalone maps (no GLB embed); loaded as hashed Vite URLs (outside the JS bundle). |

## Composites (no single kit piece existed — built from the pieces above)

Built by `scripts/curate-assets.py` from **KayKit Dungeon Remastered** meshes
only (same CC0 license, same texture atlas):

- `kit/torii.glb` — 4 transformed instances of `pillar`: two uprights, a
  rotated/scaled kasagi top beam and nuki tie beam. ~4.6 × 4.1 m.
- `kit/throne.glb` — `floor_tile_small` (scaled, as plinth) + `chair`
  (scaled to a 2.3 m high-back seat, faces +z) + 2 × `column` at the back
  corners. ~2.6 × 3.5 m.
- `kit/statue-knight.glb` — `pillar` (squat pedestal) + `sword_shield`
  crossed-swords-and-shield trophy mounted above. ~1.9 × 3.2 m memorial.

## Procedural geometry (Task 2 — Greater Vael exterior forest)

The instanced forest — grass tuft (`grass-tuft`), sparse trunk (`pine-sparse`),
dense pine (`pine-dense`) — and the terrain skirt are **original geometry
generated in code** (`src/world/exteriorForest.ts`), not a fetched pack, and
are released **CC0** with the rest of the project. No download, no texture:
the OATHBRAND ash palette is baked straight into vertex colours.

This is a deliberate, documented substitution for the brief's "KayKit/Quaternius
pine + rock" fetch. Instancing multiplies a mesh's triangles by its population,
so the drop's `tris < 100k visible` budget forces *very* low-poly trees; real
CC0 pines evaluated for this task (Quaternius "Pine", poly.pizza `79gmlLnweB`,
CC0 — ~1.7k tris; and "Pine Tree with Snow" `17vQv2X5rh`, CC0 — ~1.7k tris)
would blow the budget at a few dozen dense trees. Authoring the geometry caps
the dense pine at ~74 tris (crooked rebuild, C3; budget guard 160), keeps the bundle unchanged (no GLB, no texture), and
gives the flat-shaded PS1 look directly — so no `downsample-textures` darkening
pass is needed (the palette is authored dark). Verified in-browser at 9 draw
calls / ~16k triangles for a 105-tree test zone (`docs/shots/gv-task2-*.png`).

The realism-pass props — the hanging **gibbet cage** (`gibbet`, ~96 tris, the
Gate Fields folk-horror motif) and the charred **roof wedge** (`roof-wedge`,
~12 tris, capping every Cinder Village house block) — are likewise **original
CC0 geometry generated in code** (`src/world/exteriorProps.ts`), vertex-coloured
in the OATHBRAND ash palette, no download and no texture. The gibbet is one
standalone mesh (1 draw); the roof wedges are one InstancedMesh across all house
cells (1 draw). The Cinder door-void houses reuse the existing `wall-arch.glb`
(same KayKit atlas → same merge bucket, no new asset).

The **watchtower shell** (`tower-shell`, ~84 tris, World Expansion v1.2 Task 6 —
the Gate Fields watchtower silhouette: a tapered octagonal masonry shaft with an
open crenellated crown, one merlon fallen for the ruin) is likewise **original
CC0 geometry generated in code** (`src/world/exteriorProps.ts`), vertex-coloured,
no download and no texture — one standalone off-grid backdrop mesh (1 draw).

The **sunken-chapel shell** (`chapel-shell`, ~46 tris, World Expansion v1.2 Task 7
— the Ashen Forest chapel silhouette: a tall stone nave with its south half
roofless, a pitched gable over the tended north end, and a leaning cross at the
peak) is likewise **original CC0 geometry generated in code**
(`src/world/exteriorProps.ts`), vertex-coloured, no download and no texture — one
standalone off-grid backdrop mesh (1 draw).

## Processing applied (all repeatable via `bash scripts/fetch-assets.sh`)

- Texture atlases downsampled to 128 px, darkened toward the OATHBRAND palette
  (ash `#8a8a92`, ember `#c4501e`, blood `#5e1f1f`, void `#0d0d10`), posterized
  to 5 bits/channel, then re-embedded into each GLB
  (`scripts/downsample-textures.py`).
- Untextured materials (crown) had `baseColorFactor` darkened with the same
  palette function.

## Audio (Task 17)

The **recorded CC0 pack is the primary voice** (~3.8 MB, all rows above,
fetched by `scripts/fetch-audio.sh` / `npm run audio:fetch`, every download
pinned by sha256 — the script hard-fails on a bad pin):

- Looping ambience under the zone beds: `audio/amb-dungeon.ogg` (interior
  halls/crypt/throne), `audio/amb-wind.ogg` (gate/ramparts/summit/garden, at
  varied playback rates), `audio/amb-dark.ogg` (the vigil pad + ember-hum
  undertone).
- One-shot SFX: `audio/swing.ogg`, `audio/hit.ogg`, `audio/door.ogg`,
  `audio/bow.wav`.

Everything **without** a recorded source is synthesized at runtime by
`src/audio/AudioManager.ts`: the threat heartbeat, the 1.8 s stone-reverb
impulse, every musical cue (kneel motif, vista swell, boss card, per-ending
chords), and the three character textures with no CC0 recording in the pack
(wraith whisper, dragon breath, banner cloth). Every recorded voice also has a
synth fallback — a build without the pack is thinner-textured but never silent.

Attribution is not required by CC0, but credit **Kay Lousberg
(www.kaylousberg.com)**, **Quaternius (quaternius.com)**, **Kenney
(www.kenney.nl)**, and the OpenGameArt authors **JaggedStone**, **SketchMan3**,
**northivanastan**, and **Ogrebane** in the game credits anyway.

## Fonts (Task 18)

The interface's carved-stone display voice (the OATHBRAND wordmark, menu items,
title cards, inscription titles, section labels) is set in **Cinzel**, an
inscriptional-Roman serif — chosen because the whole game is words scored into
stone. The other two UI voices are system faces (Georgia for spoken-word prose,
Courier for the mechanism/prompts) and need no vendored file.

| Source | Author | URL (pinned) | License | Files taken |
|---|---|---|---|---|
| Cinzel (Google Fonts) | Natanael Gama · The Cinzel Project Authors (github.com/NDISCOVER/Cinzel) | <https://fonts.google.com/specimen/Cinzel> — `v26` latin subset, variable weight; woff2 sha256 `09941fb1…c8f370` (`fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7.woff2`) | SIL OFL 1.1 | `src/fonts/cinzel-latin.woff2` (25.9 KB, one file serves weights 400–900); full licence text `src/fonts/Cinzel-OFL.txt` |

The SIL Open Font License permits redistribution and web embedding; the Reserved
Font Name is "Cinzel". The vendored subset is the unmodified upstream latin
subset (no glyph edits, no renaming).
