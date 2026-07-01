#!/usr/bin/env python3
"""Curate CC0 kit pieces from .assets-cache/ into assets/kit/ (canonical names).

Run after scripts/fetch-assets.sh has populated .assets-cache/.
Usage: python3 scripts/curate-assets.py

What it does:
  1. Copies 13 pieces (11 dungeon + 2 skeletons) under canonical names,
     renaming the root node to the canonical stem.
  2. Builds composites (documented in assets/LICENSES.md):
       torii.glb         — 4 transformed instances of the dungeon pillar
       throne.glb        — plinth (floor tile) + scaled chair + 2 columns
       statue-knight.glb — pedestal pillar + sword&shield trophy
  3. Normalizes crown.glb (Quaternius) to relic scale, grounded at y=0,
     and darkens its material colors toward the OATHBRAND palette.

Textures are processed/re-embedded afterwards by downsample-textures.py.
"""

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb_lib as G

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.assets-cache')
KIT = os.path.join(ROOT, 'assets', 'kit')

DUNGEON = os.path.join(CACHE, 'kaykit-dungeon-remastered', 'addons', 'kaykit_dungeon_remastered', 'Assets', 'gltf')
SKELETONS = os.path.join(CACHE, 'kaykit-skeletons', 'addons', 'kaykit_character_pack_skeletons', 'Characters', 'gltf')

# canonical name -> source file (straight copies)
COPY_MAP = {
    'wall.glb': (DUNGEON, 'wall.gltf.glb'),
    'wall-door.glb': (DUNGEON, 'wall_doorway.glb'),
    'wall-arch.glb': (DUNGEON, 'wall_arched.gltf.glb'),
    'floor.glb': (DUNGEON, 'floor_tile_large.gltf.glb'),   # 4x4 m — same module as walls
    'stairs.glb': (DUNGEON, 'stairs.gltf.glb'),
    'pillar.glb': (DUNGEON, 'pillar.gltf.glb'),
    'banner.glb': (DUNGEON, 'banner_red.gltf.glb'),
    'torch.glb': (DUNGEON, 'torch_mounted.gltf.glb'),      # wall-mounted bracket torch
    'crate.glb': (DUNGEON, 'box_large.gltf.glb'),
    'rubble.glb': (DUNGEON, 'rubble_half.gltf.glb'),       # 4 m module rubble pile
    'gate.glb': (DUNGEON, 'wall_gated.gltf.glb'),          # wall with metal-bar gate
    'skeleton-warrior.glb': (SKELETONS, 'Skeleton_Warrior.glb'),
    'skeleton-archer.glb': (SKELETONS, 'Skeleton_Rogue.glb'),  # pack's crossbow/ranged unit
}


def copy_and_rename(canonical, src_dir, src_name):
    src = os.path.join(src_dir, src_name)
    dst = os.path.join(KIT, canonical)
    gltf, bin_chunk = G.read_glb(src)
    stem = canonical[:-4]
    # rename scene-root nodes to the canonical stem for debuggability
    scene = gltf['scenes'][gltf.get('scene', 0)]
    for i, node_idx in enumerate(scene['nodes']):
        gltf['nodes'][node_idx]['name'] = stem if i == 0 else f'{stem}-{i}'
    if canonical == 'rubble.glb':
        # source pivot sits at the piece's x edge — recenter on x
        gltf['nodes'][scene['nodes'][0]]['translation'] = [-2.0, 0.0, 0.0]
    G.write_glb(dst, gltf, bin_chunk)
    return dst


def build_torii():
    """Torii gate from 4 transformed instances of the dungeon pillar mesh.

    Pillar mesh: 1.5 x 4 x 1.5 m, base at y=0. Result ~4.6 m wide, 4.1 m tall
    (matches the 4 m wall module).
    """
    gltf, bin_chunk = G.read_glb(os.path.join(DUNGEON, 'pillar.gltf.glb'))
    root = G.make_composite_root(gltf, 'torii')
    lie = G.rot_z(-90)  # pillar's +y (length) now points along +x
    G.add_instance(gltf, root, 'torii-post-left', 0, translation=[-1.5, 0, 0], scale=[0.45, 1.0, 0.45])
    G.add_instance(gltf, root, 'torii-post-right', 0, translation=[1.5, 0, 0], scale=[0.45, 1.0, 0.45])
    # kasagi (top beam): 4.6 m long, overhanging the posts
    G.add_instance(gltf, root, 'torii-kasagi', 0, translation=[-2.3, 3.85, 0], rotation=lie, scale=[0.35, 1.15, 0.35])
    # nuki (lower tie beam): 3.8 m
    G.add_instance(gltf, root, 'torii-nuki', 0, translation=[-1.9, 2.9, 0], rotation=lie, scale=[0.28, 0.95, 0.28])
    G.write_glb(os.path.join(KIT, 'torii.glb'), gltf, bin_chunk)


def build_throne():
    """Throne: raised stone plinth + high-backed (scaled) chair + flanking columns.

    Base GLB = chair; plinth/column geometry merged in (same atlas/material).
    Seat faces +z; columns stand at the back (-z). ~2.6 m footprint, 3.5 m tall.
    """
    gltf, bin_chunk = G.read_glb(os.path.join(DUNGEON, 'chair.gltf.glb'))
    tile, tile_bin = G.read_glb(os.path.join(DUNGEON, 'floor_tile_small.gltf.glb'))
    col, col_bin = G.read_glb(os.path.join(DUNGEON, 'column.gltf.glb'))
    bin_chunk, tile_map = G.merge_geometry(gltf, bin_chunk, tile, tile_bin)
    bin_chunk, col_map = G.merge_geometry(gltf, bin_chunk, col, col_bin)

    root = G.make_composite_root(gltf, 'throne')
    # plinth: floor_tile_small is 2x2 m, y in [-0.1, 0.05]; scaled 2x on y, lifted so top lands at y=0.3
    G.add_instance(gltf, root, 'throne-plinth', tile_map[0], translation=[0, 0.2, 0], scale=[1.3, 2.0, 1.3])
    # seat: chair 0.75x1.23 m -> 1.2 wide x 2.3 tall high-back throne on the plinth.
    # The source chair's back is at +x (it faces -x); rotate +90° about y so it faces +z.
    G.add_instance(gltf, root, 'throne-seat', 0, translation=[0, 0.3, 0.1], rotation=G.rot_y(90), scale=[1.6, 1.9, 1.6])
    # flanking columns on the plinth's back corners
    for side, x in (('left', -0.95), ('right', 0.95)):
        G.add_instance(gltf, root, f'throne-column-{side}', col_map[0], translation=[x, 0.3, -0.85], scale=[1.0, 2.3, 1.0])
    G.write_glb(os.path.join(KIT, 'throne.glb'), gltf, bin_chunk)


def build_statue_knight():
    """Knight memorial statue: pedestal (squat pillar) + sword&shield trophy.

    Pillar 1.5x4x1.5 scaled to a 1.2x1.8 m pedestal; the crossed-swords+shield
    trophy (2.2x1.7 m, centered near its own origin) floats mounted above it.
    Total ~3 m tall.
    """
    gltf, bin_chunk = G.read_glb(os.path.join(DUNGEON, 'pillar.gltf.glb'))
    trophy, trophy_bin = G.read_glb(os.path.join(DUNGEON, 'sword_shield.gltf.glb'))
    bin_chunk, trophy_map = G.merge_geometry(gltf, bin_chunk, trophy, trophy_bin)

    root = G.make_composite_root(gltf, 'statue-knight')
    G.add_instance(gltf, root, 'statue-pedestal', 0, scale=[0.8, 0.45, 0.8])  # 1.2 x 1.8 x 1.2
    # trophy vertical extent is roughly [-0.82, +0.85] around its origin;
    # at y=2.5 its lowest point sits flush on the 1.8 m pedestal top
    G.add_instance(gltf, root, 'statue-trophy', trophy_map[0], translation=[0, 2.5, 0], scale=[0.85, 0.85, 0.85])
    G.write_glb(os.path.join(KIT, 'statue-knight.glb'), gltf, bin_chunk)


def build_crown():
    """Normalize the Quaternius crown: 0.45 m wide, grounded at y=0, palette-darkened."""
    src = os.path.join(CACHE, 'polypizza', 'crown.glb')
    gltf, bin_chunk = G.read_glb(src)
    mins, maxs = G.world_bbox(gltf)
    width = max(maxs[0] - mins[0], maxs[2] - mins[2])
    s = 0.45 / width
    cx, cz = (mins[0] + maxs[0]) / 2, (mins[2] + maxs[2]) / 2
    scene = gltf['scenes'][gltf.get('scene', 0)]
    wrap = {'name': 'crown', 'children': list(scene['nodes']),
            'scale': [s, s, s], 'translation': [-cx * s, -mins[1] * s, -cz * s]}
    gltf['nodes'].append(wrap)
    scene['nodes'] = [len(gltf['nodes']) - 1]
    for mat in gltf.get('materials', []):
        pbr = mat.get('pbrMetallicRoughness', {})
        if 'baseColorFactor' in pbr:
            pbr['baseColorFactor'] = G.darken_linear_factor(pbr['baseColorFactor'])
        pbr['metallicFactor'] = 0.0
        pbr['roughnessFactor'] = 1.0
    G.write_glb(os.path.join(KIT, 'crown.glb'), gltf, bin_chunk)


def main():
    missing = [p for p in (DUNGEON, SKELETONS, os.path.join(CACHE, 'polypizza', 'crown.glb')) if not os.path.exists(p)]
    if missing:
        for m in missing:
            print(f'MISSING: {m}', file=sys.stderr)
        print('Run scripts/fetch-assets.sh first.', file=sys.stderr)
        sys.exit(1)

    os.makedirs(KIT, exist_ok=True)
    for canonical, (src_dir, src_name) in COPY_MAP.items():
        copy_and_rename(canonical, src_dir, src_name)
        print(f'  {canonical:24s} <- {src_name}')
    build_torii(); print('  torii.glb                <- composite: pillar x4')
    build_throne(); print('  throne.glb               <- composite: chair + floor_tile_small + column x2')
    build_statue_knight(); print('  statue-knight.glb        <- composite: pillar + sword_shield')
    build_crown(); print('  crown.glb                <- Quaternius crown (normalized, palette-darkened)')
    print(f'curated {len(os.listdir(KIT))} files into assets/kit/')


if __name__ == '__main__':
    main()
