#!/usr/bin/env python3
"""Texture pipeline: downsample atlases to 128 px, darken toward the OATHBRAND
palette (ash #8a8a92, ember #c4501e, blood #5e1f1f, void #0d0d10), posterize
to 5 bits/channel — then re-embed the processed atlas into every kit GLB.

Idempotent: always reads the PRISTINE source atlases from .assets-cache/
(never the already-darkened copies), so re-running yields identical output.

Requires: python3 + Pillow (PIL). `sharp` was deliberately NOT added — a
native npm devDependency is overkill when PIL is already on the machine and
this never runs at app runtime (assets are processed at curation time only).

Usage: python3 scripts/downsample-textures.py
"""

import os
import io
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb_lib as G

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.assets-cache')
KIT = os.path.join(ROOT, 'assets', 'kit')
TEX = os.path.join(ROOT, 'assets', 'tex')

SIZE = 128

# atlas name (as embedded in the GLBs' images[].name) -> pristine source
SOURCES = {
    'dungeon_texture': os.path.join(
        CACHE, 'kaykit-dungeon-remastered', 'addons', 'kaykit_dungeon_remastered', 'Assets', 'texture', 'dungeon_texture.png'),
    'skeleton_texture': os.path.join(
        CACHE, 'kaykit-skeletons', 'addons', 'kaykit_character_pack_skeletons', 'Textures', 'skeleton_texture.png'),
}


def process_atlas(src_path):
    """1024 px atlas -> 128 px, darkened toward palette, posterized 5 bits."""
    im = Image.open(src_path).convert('RGBA')
    im = im.resize((SIZE, SIZE), Image.BILINEAR)
    px = im.load()
    cache = {}
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            key = (r, g, b)
            out = cache.get(key)
            if out is None:
                out = G.darken_srgb(r, g, b)
                cache[key] = out
            px[x, y] = (out[0], out[1], out[2], a)
    return im


def png_bytes(im):
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def main():
    os.makedirs(TEX, exist_ok=True)
    processed = {}
    for name, src in SOURCES.items():
        if not os.path.exists(src):
            print(f'MISSING source atlas: {src} — run scripts/fetch-assets.sh first.', file=sys.stderr)
            sys.exit(1)
        im = process_atlas(src)
        data = png_bytes(im)
        out = os.path.join(TEX, f'{name}.png')
        with open(out, 'wb') as f:
            f.write(data)
        processed[name] = data
        print(f'  assets/tex/{name}.png  ({im.size[0]}px, {len(data) / 1024:.1f} KB)')

    # re-embed the processed atlases into every kit GLB that carries one
    for fname in sorted(os.listdir(KIT)):
        if not fname.endswith('.glb'):
            continue
        path = os.path.join(KIT, fname)
        gltf, bin_chunk = G.read_glb(path)
        images = gltf.get('images', [])
        changed = False
        for i, img in enumerate(images):
            data = processed.get(img.get('name', ''))
            if data is not None and 'bufferView' in img:
                bin_chunk = G.replace_image(gltf, bin_chunk, i, data)
                changed = True
        if changed:
            before = os.path.getsize(path)
            G.write_glb(path, gltf, bin_chunk)
            after = os.path.getsize(path)
            print(f'  re-embedded atlas: {fname} ({before / 1024:.0f} -> {after / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
