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
| *(audio — TBD by Task 17)* | — | — | CC0 required | `audio/` is an empty placeholder; add one row per audio source when filled |

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

## Processing applied (all repeatable via `bash scripts/fetch-assets.sh`)

- Texture atlases downsampled to 128 px, darkened toward the OATHBRAND palette
  (ash `#8a8a92`, ember `#c4501e`, blood `#5e1f1f`, void `#0d0d10`), posterized
  to 5 bits/channel, then re-embedded into each GLB
  (`scripts/downsample-textures.py`).
- Untextured materials (crown) had `baseColorFactor` darkened with the same
  palette function.

Attribution is not required by CC0, but credit **Kay Lousberg
(www.kaylousberg.com)** and **Quaternius (quaternius.com)** in the game
credits anyway.
