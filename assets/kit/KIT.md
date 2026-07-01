# Kit piece manifest

Canonical GLB modules for zone building. Sources/licenses: `../LICENSES.md`.
Rebuild everything with `bash scripts/fetch-assets.sh`; verify with
`node scripts/verify-gltf.mjs`.

**Module scale:** the KayKit architecture pieces are on a **4 m module**
(walls 4 m wide × 4 m tall, floor 4×4 m). The zone grid cell is **2 m**
(`ZoneDef.cell`), so ZoneBuilder should place architecture at **uniform
scale 0.5** (→ 2 m walls/floors) or span 2×2 cells per piece at scale 1.
Props (torch, crate, banner, throne…) are life-sized — place at scale 1
even when architecture is scaled.

| File | bbox (x·y·z m) | Origin | Notes |
|---|---|---|---|
| wall.glb | 4.00·4.00·1.00 | base center | solid wall segment |
| wall-door.glb | 4.00·4.00·1.00 | base center | doorway opening (2 meshes) |
| wall-arch.glb | 4.00·4.00·1.00 | base center | open archway |
| gate.glb | 4.00·4.00·1.00 | base center | wall with metal-bar gate |
| floor.glb | 4.00·0.15·4.00 | top ≈ y 0.05 | 4×4 tile; surface slightly above 0 |
| stairs.glb | 5.00·5.10·4.00 | bottom, runs +z | climbs a full 4 m module (+1 m parapet) |
| pillar.glb | 1.50·4.00·1.50 | base center | freestanding pillar |
| banner.glb | 1.50·3.20·0.31 | hangs y 0.53–3.73, z 0.38–0.69 | wall-hung red banner — place against a wall face |
| torch.glb | 0.55·1.06·0.62 | bracket at origin, extends +z | wall-mounted; add PointLight in-engine |
| crate.glb | 1.50·1.50·1.50 | base center | wooden crate |
| rubble.glb | 4.00·3.50·3.00 | base center (recentered) | rock pile, blocks a corridor at 0.5 scale |
| throne.glb | 2.60·3.52·2.60 | base center, **faces +z** | composite: plinth+seat+columns |
| statue-knight.glb | 1.90·3.22·1.20 | base center | composite: pedestal + sword/shield trophy |
| torii.glb | 4.60·4.11·0.67 | base center, spans x | composite gate, opening ≈ 2.3 m wide |
| crown.glb | 0.45·0.30·0.45 | base center | quest relic; untextured palette-dark gold/red |
| skeleton-warrior.glb | 1.94·2.59·1.46 | feet at origin | skinned, 95 clips (see verify output) |
| skeleton-archer.glb | 1.94·2.31·1.15 | feet at origin | skinned, 95 clips; = KayKit Skeleton Rogue |

Details that matter downstream:

- **Textures** are embedded, already 128 px + palette-darkened + posterized —
  no runtime processing needed. Samplers are glTF defaults; the PS1 pipeline's
  material patch should set `NearestFilter` for the crunchy look.
- **Skeleton clips** (Task 9): melee kit = `Idle_Combat`, `Walking_A/B/C`,
  `Running_A`, `1H_Melee_Attack_*`, `Hit_A/B`, `Death_A/B`,
  `Skeletons_Awaken_Standing/Floor`, `Spawn_Ground_Skeletons`. Ranged kit =
  `2H_Ranged_Aiming/Shoot/Shooting/Reload`. Both models share the same rig +
  clip names.
- **Weapons are separate**: skeleton hands are empty. If Task 9 wants visible
  weapons, the pack's `Skeleton_Blade/Crossbow/Shield_*` GLTFs are in
  `.assets-cache/kaykit-skeletons/.../Assets/gltf/` (same CC0 pack — add a
  LICENSES.md row when curating them in).
