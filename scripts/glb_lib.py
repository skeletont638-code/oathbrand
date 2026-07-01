"""Minimal GLB (glTF-Binary 2.0) toolkit for the OATHBRAND asset pipeline.

Pure stdlib. Used by curate-assets.py and downsample-textures.py.

Capabilities:
  - read/write GLB (JSON + BIN chunks)
  - world-space bbox from accessor min/max through node transforms
  - single-source instancing (N transformed nodes sharing one mesh)
  - multi-source merge (append geometry of another GLB, reuse base material)
  - embedded-image replacement (rebuilds the BIN chunk)
  - palette darkening for colors (shared with the texture pipeline)
"""

import json
import math
import struct

GLB_MAGIC = 0x46546C67  # 'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

# OATHBRAND palette: ash, ember, blood, void (sRGB 0-255)
PALETTE = [(0x8A, 0x8A, 0x92), (0xC4, 0x50, 0x1E), (0x5E, 0x1F, 0x1F), (0x0D, 0x0D, 0x10)]
DARKEN = 0.66  # global multiply
PALETTE_MIX = 0.30  # blend toward nearest palette color
POSTERIZE_BITS = 5


# ---------------------------------------------------------------- GLB I/O

def read_glb(path):
    """Return (gltf_json_dict, bin_bytes)."""
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, _length = struct.unpack('<III', data[:12])
    if magic != GLB_MAGIC or version != 2:
        raise ValueError(f'{path}: not a GLB v2 file')
    offset = 12
    gltf, bin_chunk = None, b''
    while offset < len(data):
        clen, ctype = struct.unpack('<II', data[offset:offset + 8])
        chunk = data[offset + 8:offset + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(chunk)
        elif ctype == CHUNK_BIN:
            bin_chunk = bytes(chunk)
        offset += 8 + clen
    if gltf is None:
        raise ValueError(f'{path}: missing JSON chunk')
    return gltf, bin_chunk


def write_glb(path, gltf, bin_chunk):
    if gltf.get('buffers'):
        gltf['buffers'][0]['byteLength'] = len(bin_chunk)
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    bn = bytes(bin_chunk) + b'\x00' * (-len(bin_chunk) % 4)
    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', GLB_MAGIC, 2, total))
        f.write(struct.pack('<II', len(js), CHUNK_JSON))
        f.write(js)
        f.write(struct.pack('<II', len(bn), CHUNK_BIN))
        f.write(bn)


# ------------------------------------------------------------- transforms

def _quat_to_mat3(q):
    x, y, z, w = q
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]


def _node_matrix(node):
    """4x4 (row-major) from node TRS or matrix."""
    if 'matrix' in node:
        m = node['matrix']  # column-major in glTF
        return [[m[0], m[4], m[8], m[12]],
                [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]],
                [m[3], m[7], m[11], m[15]]]
    t = node.get('translation', [0, 0, 0])
    r = node.get('rotation', [0, 0, 0, 1])
    s = node.get('scale', [1, 1, 1])
    rm = _quat_to_mat3(r)
    return [
        [rm[0][0] * s[0], rm[0][1] * s[1], rm[0][2] * s[2], t[0]],
        [rm[1][0] * s[0], rm[1][1] * s[1], rm[1][2] * s[2], t[1]],
        [rm[2][0] * s[0], rm[2][1] * s[1], rm[2][2] * s[2], t[2]],
        [0, 0, 0, 1],
    ]


def _mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def _mat_xform(m, v):
    return [m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(3)]


def world_bbox(gltf):
    """World bbox of scene 0 from POSITION accessor min/max (8-corner transform)."""
    mins = [math.inf] * 3
    maxs = [-math.inf] * 3

    def visit(node_idx, parent_m):
        node = gltf['nodes'][node_idx]
        m = _mat_mul(parent_m, _node_matrix(node))
        if 'mesh' in node:
            mesh = gltf['meshes'][node['mesh']]
            for prim in mesh['primitives']:
                acc = gltf['accessors'][prim['attributes']['POSITION']]
                lo, hi = acc['min'], acc['max']
                for cx in (lo[0], hi[0]):
                    for cy in (lo[1], hi[1]):
                        for cz in (lo[2], hi[2]):
                            p = _mat_xform(m, [cx, cy, cz])
                            for i in range(3):
                                mins[i] = min(mins[i], p[i])
                                maxs[i] = max(maxs[i], p[i])
        for child in node.get('children', []):
            visit(child, m)

    ident = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    scene = gltf['scenes'][gltf.get('scene', 0)]
    for root in scene['nodes']:
        visit(root, ident)
    return mins, maxs


def rot_z(deg):
    """Quaternion [x,y,z,w] for rotation about +Z."""
    h = math.radians(deg) / 2
    return [0, 0, math.sin(h), math.cos(h)]


def rot_y(deg):
    h = math.radians(deg) / 2
    return [0, math.sin(h), 0, math.cos(h)]


# ---------------------------------------------------------- scene editing

def make_composite_root(gltf, name):
    """Replace scene 0 roots with a single named root; return its index."""
    root = {'name': name, 'children': []}
    gltf['nodes'].append(root)
    idx = len(gltf['nodes']) - 1
    gltf['scenes'][gltf.get('scene', 0)]['nodes'] = [idx]
    return idx


def add_instance(gltf, root_idx, name, mesh_idx, translation=None, rotation=None, scale=None):
    node = {'name': name, 'mesh': mesh_idx}
    if translation:
        node['translation'] = translation
    if rotation:
        node['rotation'] = rotation
    if scale:
        node['scale'] = scale
    gltf['nodes'].append(node)
    gltf['nodes'][root_idx]['children'].append(len(gltf['nodes']) - 1)
    return len(gltf['nodes']) - 1


def _image_buffer_views(gltf):
    return {img['bufferView'] for img in gltf.get('images', []) if 'bufferView' in img}


def merge_geometry(base, base_bin, src, src_bin):
    """Append src's geometry (bufferViews/accessors/meshes) to base.

    Skips src images/textures/materials: merged primitives point at base
    material 0 (valid for KayKit pieces — one shared atlas material).
    Returns (new_bin, mesh_index_map src->base).
    """
    out = bytearray(base_bin)
    img_views = _image_buffer_views(src)
    bv_map = {}
    for i, bv in enumerate(src.get('bufferViews', [])):
        if i in img_views:
            continue
        out += b'\x00' * (-len(out) % 4)
        start = bv.get('byteOffset', 0)
        data = src_bin[start:start + bv['byteLength']]
        new_bv = {'buffer': 0, 'byteOffset': len(out), 'byteLength': bv['byteLength']}
        if 'byteStride' in bv:
            new_bv['byteStride'] = bv['byteStride']
        if 'target' in bv:
            new_bv['target'] = bv['target']
        out += data
        base.setdefault('bufferViews', []).append(new_bv)
        bv_map[i] = len(base['bufferViews']) - 1

    acc_map = {}
    for i, acc in enumerate(src.get('accessors', [])):
        new_acc = dict(acc)
        if 'bufferView' in new_acc:
            if new_acc['bufferView'] not in bv_map:
                continue  # accessor into an image view — not expected
            new_acc['bufferView'] = bv_map[new_acc['bufferView']]
        base.setdefault('accessors', []).append(new_acc)
        acc_map[i] = len(base['accessors']) - 1

    mesh_map = {}
    for i, mesh in enumerate(src.get('meshes', [])):
        new_mesh = {'name': mesh.get('name', f'mesh{i}'), 'primitives': []}
        for prim in mesh['primitives']:
            new_prim = {'attributes': {k: acc_map[v] for k, v in prim['attributes'].items()}}
            if 'indices' in prim:
                new_prim['indices'] = acc_map[prim['indices']]
            if 'mode' in prim:
                new_prim['mode'] = prim['mode']
            new_prim['material'] = 0
            new_mesh['primitives'].append(new_prim)
        base['meshes'].append(new_mesh)
        mesh_map[i] = len(base['meshes']) - 1

    return bytes(out), mesh_map


def replace_image(gltf, bin_chunk, image_idx, new_bytes):
    """Swap embedded image `image_idx` bytes; rebuild BIN, fix offsets."""
    target_bv = gltf['images'][image_idx]['bufferView']
    out = bytearray()
    for i, bv in enumerate(gltf['bufferViews']):
        out += b'\x00' * (-len(out) % 4)
        if i == target_bv:
            data = new_bytes
        else:
            start = bv.get('byteOffset', 0)
            data = bin_chunk[start:start + bv['byteLength']]
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(data)
        out += data
    return bytes(out)


# ------------------------------------------------------------ palette ops

def _srgb_to_linear(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(c):
    c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return max(0.0, min(1.0, c)) * 255.0


def darken_srgb(r, g, b):
    """Darken an sRGB 0-255 triple toward the OATHBRAND palette + posterize."""
    r, g, b = r * DARKEN, g * DARKEN, b * DARKEN
    p = min(PALETTE, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
    r = r * (1 - PALETTE_MIX) + p[0] * PALETTE_MIX
    g = g * (1 - PALETTE_MIX) + p[1] * PALETTE_MIX
    b = b * (1 - PALETTE_MIX) + p[2] * PALETTE_MIX
    levels = (1 << POSTERIZE_BITS) - 1
    q = lambda v: round(round(v / 255 * levels) / levels * 255)
    return q(r), q(g), q(b)


def darken_linear_factor(rgba):
    """Darken a linear-space baseColorFactor [r,g,b,a] toward the palette."""
    srgb = [_linear_to_srgb(c) for c in rgba[:3]]
    dr, dg, db = darken_srgb(*srgb)
    return [_srgb_to_linear(dr), _srgb_to_linear(dg), _srgb_to_linear(db), rgba[3] if len(rgba) > 3 else 1.0]
