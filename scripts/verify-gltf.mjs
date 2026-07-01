#!/usr/bin/env node
/**
 * Verify every assets/kit/*.glb loads through three.js GLTFLoader (the same
 * loader the game uses), headless in Node.
 *
 * Node has no DOM image decoding, so image *decode* is stubbed here (the
 * PNG bytes themselves are decoded/re-encoded by PIL in
 * scripts/downsample-textures.py). Geometry, scene graph, skins and
 * animations all go through the real GLTFLoader parse path.
 *
 * Usage: node scripts/verify-gltf.mjs
 * Exit code 0 = all pieces load; 1 = at least one failure.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- headless polyfills (must exist before the loader is constructed) ------
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
if (typeof globalThis.createImageBitmap === 'undefined') {
  globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
}
if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:stub';
if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {};
// Skip fetch/decode of embedded images entirely — hand back a stub bitmap.
THREE.ImageBitmapLoader.prototype.load = function (url, onLoad) {
  queueMicrotask(() => onLoad({ width: 2, height: 2, close() {} }));
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(ROOT, 'assets', 'kit');

const CANONICAL = [
  'wall.glb', 'wall-door.glb', 'wall-arch.glb', 'floor.glb', 'stairs.glb',
  'pillar.glb', 'banner.glb', 'torch.glb', 'throne.glb', 'crate.glb',
  'rubble.glb', 'statue-knight.glb', 'gate.glb', 'torii.glb',
  'skeleton-warrior.glb', 'skeleton-archer.glb', 'crown.glb',
];

const loader = new GLTFLoader();
let failures = 0;
const rows = [];

for (const name of CANONICAL) {
  const file = path.join(KIT, name);
  try {
    const buf = await fs.readFile(file);
    const gltf = await new Promise((resolve, reject) =>
      loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject));
    let meshes = 0, tris = 0, skinned = false;
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        skinned ||= o.isSkinnedMesh === true;
        const g = o.geometry;
        tris += Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
      }
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const dims = ['x', 'y', 'z'].map((a) => (box.max[a] - box.min[a]).toFixed(2)).join('x');
    const kb = (buf.byteLength / 1024).toFixed(0);
    const anims = gltf.animations.map((a) => a.name);
    rows.push(`OK   ${name.padEnd(22)} ${String(kb).padStart(5)}KB  meshes=${meshes} tris=${tris} bbox=${dims}m${skinned ? ' skinned' : ''}${anims.length ? ` anims=${anims.length}` : ''}`);
    if (anims.length) rows.push(`     clips: ${anims.join(', ')}`);
  } catch (err) {
    failures++;
    rows.push(`FAIL ${name.padEnd(22)} ${err?.message ?? err}`);
  }
}

console.log(rows.join('\n'));
console.log(failures === 0
  ? `\nverify-gltf: all ${CANONICAL.length} canonical pieces load.`
  : `\nverify-gltf: ${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
