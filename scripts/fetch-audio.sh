#!/usr/bin/env bash
# OATHBRAND audio pipeline — fetch the recorded CC0 audio pack (Task 17).
#
# Usage: bash scripts/fetch-audio.sh   (or: npm run audio:fetch)
#
# The recorded layer is PRIMARY: looping CC0 ambience (dungeon / wind / dark
# music) backs the zone beds, and CC0 one-shots back the swing/hit/door/bow
# SFX. Everything else (heartbeat, stone-reverb impulse, musical cues, and the
# whisper/breath/cloth beds with no recorded source) is synthesized in
# src/audio/AudioManager.ts. Every recorded file is also OPTIONAL at runtime —
# a missing file falls back to that voice's synth version, so a build without
# this script is thinner-textured but never silent.
#
# Downloads land in .assets-cache/ (gitignored); only the curated files land in
# assets/audio/ (git-tracked). Every source is CC0 — see assets/LICENSES.md.
# Each download is pinned by sha256 and this script HARD-FAILS on a mismatch,
# exactly like scripts/fetch-assets.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE=.assets-cache/audio
OUT=assets/audio
mkdir -p "$CACHE" "$OUT"

command -v unzip >/dev/null || { echo "ERROR: 'unzip' is required." >&2; exit 1; }

# fetch <url> <cache-file> <sha256> — download once, always re-verify the pin.
fetch() {
  local url=$1 dest=$2 sha=$3
  if [ ! -f "$dest" ]; then
    echo "fetching $(basename "$dest")..."
    curl -fsSL -A "Mozilla/5.0" "$url" -o "$dest"
  fi
  echo "$sha  $dest" | sha256sum -c - >/dev/null \
    || { echo "ERROR: $(basename "$dest") checksum mismatch — refusing to use it." >&2; exit 1; }
}

# --- Kenney "RPG Audio" 1.0 (CC0) — blade swing + door -----------------------
fetch "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip" \
  "$CACHE/rpg-audio.zip" 6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b

# --- Kenney "Impact Sounds" 1.0 (CC0) — wood thud ----------------------------
fetch "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip" \
  "$CACHE/impact-sounds.zip" 029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8

# --- OpenGameArt "Loopable Dungeon Ambience" (JaggedStone, CC0) ---------------
# https://opengameart.org/content/loopable-dungeon-ambience
fetch "https://opengameart.org/sites/default/files/dungeon_ambient_1_0.ogg" \
  "$CACHE/amb-dungeon.ogg" df491823e4877371c34dbda4e9321cd83a4a14fa7573cee0ebca1ae423b70e6e

# --- OpenGameArt "Wind Whoosh Loop" (SketchMan3, CC0) --------------------------
# https://opengameart.org/content/wind-whoosh-loop
fetch "https://opengameart.org/sites/default/files/wind%20woosh%20loop.ogg" \
  "$CACHE/amb-wind.ogg" 0cfdbd3f21ed449689a9024264edf267d0037a6495813a7010827672ec191dac

# --- OpenGameArt "Derelict" (northivanastan, CC0) ------------------------------
# From the OGA "CC0 Dark Music" collection (opengameart.org/content/cc0-dark-music).
# https://opengameart.org/content/derelict
fetch "https://opengameart.org/sites/default/files/derelict.ogg" \
  "$CACHE/amb-dark.ogg" 5d097b75cdd5e30d32fd6ce5c0c52f12582f6da6fd728d7ea97fbc80048015ce

# --- OpenGameArt "Battle Sound Effects" (Ogrebane) — crossbow twang ------------
# https://opengameart.org/content/battle-sound-effects — multi-licensed
# CC0 / CC-BY 3.0 / CC-BY-SA 3.0 / GPL 2.0 / GPL 3.0; we take it under CC0.
fetch "https://opengameart.org/sites/default/files/battle_sound_effects_0.zip" \
  "$CACHE/battle-sfx.zip" 44e3d26b2378d2eb3a4f28b4c5cbc71908ad13c7389038348dbe9b8cde4f4c05

# --- curate ---------------------------------------------------------------------
# One-shots from the pinned zips:
unzip -p "$CACHE/rpg-audio.zip"      "Audio/knifeSlice.ogg"           > "$OUT/swing.ogg"
unzip -p "$CACHE/rpg-audio.zip"      "Audio/doorOpen_1.ogg"           > "$OUT/door.ogg"
unzip -p "$CACHE/impact-sounds.zip"  "Audio/impactWood_heavy_000.ogg" > "$OUT/hit.ogg"
unzip -p "$CACHE/battle-sfx.zip"     "battle_sound_effects/Bow.wav"   > "$OUT/bow.wav"
# Looping ambience straight from the pinned files:
cp "$CACHE/amb-dungeon.ogg" "$OUT/amb-dungeon.ogg"
cp "$CACHE/amb-wind.ogg"    "$OUT/amb-wind.ogg"
cp "$CACHE/amb-dark.ogg"    "$OUT/amb-dark.ogg"

echo "audio pipeline complete — curated files:"
for f in swing.ogg hit.ogg door.ogg bow.wav amb-dungeon.ogg amb-wind.ogg amb-dark.ogg; do
  printf '  %s  %s\n' "$(sha256sum "$OUT/$f" | cut -d' ' -f1)" "$OUT/$f"
done
