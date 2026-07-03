#!/usr/bin/env bash
# OATHBRAND asset pipeline — fetch CC0 sources, curate kit, process textures, verify.
#
# Usage: bash scripts/fetch-assets.sh
#
# Downloads go to .assets-cache/ (gitignored). Only the curated, processed
# subset lands in assets/ (git-tracked). Every source is CC0 — see
# assets/LICENSES.md. Sources are pinned (commit SHA / sha256) for
# reproducibility.
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE=.assets-cache
mkdir -p "$CACHE/polypizza"

# --- KayKit Dungeon Remastered 1.0 (CC0) ------------------------------------
DUNGEON_REPO=https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0
DUNGEON_SHA=b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07
if [ ! -d "$CACHE/kaykit-dungeon-remastered" ]; then
  echo "fetching KayKit Dungeon Remastered..."
  git clone --depth 1 --no-checkout "$DUNGEON_REPO" "$CACHE/kaykit-dungeon-remastered"
  git -C "$CACHE/kaykit-dungeon-remastered" fetch --depth 1 origin "$DUNGEON_SHA"
  git -C "$CACHE/kaykit-dungeon-remastered" checkout --detach "$DUNGEON_SHA" || { echo "ERROR: pinned SHA $DUNGEON_SHA unavailable for $DUNGEON_REPO" >&2; exit 1; }
fi

# --- KayKit Character Pack: Skeletons 1.0 (CC0) ------------------------------
SKELETON_REPO=https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
SKELETON_SHA=15b62b9bad122f72926c10fb14d622c73819fa54
if [ ! -d "$CACHE/kaykit-skeletons" ]; then
  echo "fetching KayKit Skeletons..."
  git clone --depth 1 --no-checkout "$SKELETON_REPO" "$CACHE/kaykit-skeletons"
  git -C "$CACHE/kaykit-skeletons" fetch --depth 1 origin "$SKELETON_SHA"
  git -C "$CACHE/kaykit-skeletons" checkout --detach "$SKELETON_SHA" || { echo "ERROR: pinned SHA $SKELETON_SHA unavailable for $SKELETON_REPO" >&2; exit 1; }
fi

# NOTE: KayKit's separate "Character Animations" pack is itch.io-only, but it
# is NOT needed: the Skeletons pack GLBs ship with all 95 animation clips
# embedded (verified — clip list in .superpowers/sdd/task-5-report.md).

# --- Quaternius "Crown" via poly.pizza (CC0) ---------------------------------
# https://poly.pizza/m/i0PZVuVlYv — CC0, by Quaternius
CROWN_URL=https://static.poly.pizza/1381b02a-8310-437b-a2a7-82cab0a94a4c.glb
CROWN_SHA256=c2b598cfd997ab367e2036a77d186cc02f5d2a0410209e49237b55d383c68e88
if [ ! -f "$CACHE/polypizza/crown.glb" ]; then
  echo "fetching Quaternius crown (poly.pizza)..."
  curl -fsSL -A "Mozilla/5.0" "$CROWN_URL" -o "$CACHE/polypizza/crown.glb"
fi
echo "$CROWN_SHA256  $CACHE/polypizza/crown.glb" | sha256sum -c - >/dev/null \
  || { echo "ERROR: crown.glb checksum mismatch — refusing to use it." >&2; exit 1; }

# --- Realism pass (Task 5): CC0 photo textures from AmbientCG (all CC0) -------
mkdir -p "$CACHE/ambientcg"
fetch_acg() { # $1 = asset id, $2 = local basename
  local zip="$CACHE/ambientcg/$1.zip"
  if [ ! -f "$CACHE/ambientcg/$2.jpg" ]; then
    echo "  AmbientCG $1 → $2.jpg"
    curl -fsSL -A "Mozilla/5.0" "https://ambientcg.com/get?file=${1}_1K-JPG.zip" -o "$zip" \
      || { echo "ERROR: AmbientCG $1 download failed (try the fallback id in LICENSES.md)" >&2; exit 1; }
    unzip -oq "$zip" "${1}_1K-JPG_Color.jpg" -d "$CACHE/ambientcg"
    mv "$CACHE/ambientcg/${1}_1K-JPG_Color.jpg" "$CACHE/ambientcg/$2.jpg"
  fi
}
fetch_acg Ground037 ground-dirt
fetch_acg Bark012    bark
fetch_acg Rock030    rock
fetch_acg Leather011 hound-hide
fetch_acg Fabric030  kneeler-cloth

# --- curate -> process textures -> verify ------------------------------------
python3 scripts/curate-assets.py
python3 scripts/downsample-textures.py
node scripts/verify-gltf.mjs

echo "asset pipeline complete."
