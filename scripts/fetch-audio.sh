#!/usr/bin/env bash
# OATHBRAND audio pipeline — fetch the CC0 impact-SFX pack (Task 17).
#
# Usage: bash scripts/fetch-audio.sh   (or: npm run audio:fetch)
#
# OATHBRAND's soundscape is SYNTHESIZED in WebAudio (ambient beds, heartbeat,
# reverb impulse, bow, and every musical cue) — see src/audio/AudioManager.ts —
# so almost nothing needs to ship. The one exception is the recorded impact
# layer: three tiny CC0 one-shots (a blade swing, a wood thud, a door) that read
# better sampled than synthesized. They are OPTIONAL — if this script never
# runs, the AudioManager falls back to a synth voice for each and the game is
# unchanged.
#
# Downloads land in .assets-cache/ (gitignored); only the three curated OGGs
# land in assets/audio/ (git-tracked). Every source is CC0 — see
# assets/LICENSES.md. Each ZIP is pinned by sha256 and this script HARD-FAILS on
# a mismatch, exactly like scripts/fetch-assets.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE=.assets-cache/audio
OUT=assets/audio
mkdir -p "$CACHE" "$OUT"

command -v unzip >/dev/null || { echo "ERROR: 'unzip' is required." >&2; exit 1; }

# --- Kenney "RPG Audio" 1.0 (CC0) — blade swing + door -----------------------
RPG_URL="https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip"
RPG_SHA256=6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b
if [ ! -f "$CACHE/rpg-audio.zip" ]; then
  echo "fetching Kenney RPG Audio..."
  curl -fsSL -A "Mozilla/5.0" "$RPG_URL" -o "$CACHE/rpg-audio.zip"
fi
echo "$RPG_SHA256  $CACHE/rpg-audio.zip" | sha256sum -c - >/dev/null \
  || { echo "ERROR: rpg-audio.zip checksum mismatch — refusing to use it." >&2; exit 1; }

# --- Kenney "Impact Sounds" 1.0 (CC0) — wood thud ----------------------------
IMP_URL="https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"
IMP_SHA256=029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8
if [ ! -f "$CACHE/impact-sounds.zip" ]; then
  echo "fetching Kenney Impact Sounds..."
  curl -fsSL -A "Mozilla/5.0" "$IMP_URL" -o "$CACHE/impact-sounds.zip"
fi
echo "$IMP_SHA256  $CACHE/impact-sounds.zip" | sha256sum -c - >/dev/null \
  || { echo "ERROR: impact-sounds.zip checksum mismatch — refusing to use it." >&2; exit 1; }

# --- curate: extract the three one-shots we use ------------------------------
# swing ← RPG Audio knifeSlice.ogg ; door ← RPG Audio doorOpen_1.ogg
unzip -p "$CACHE/rpg-audio.zip"     "Audio/knifeSlice.ogg"          > "$OUT/swing.ogg"
unzip -p "$CACHE/rpg-audio.zip"     "Audio/doorOpen_1.ogg"          > "$OUT/door.ogg"
# hit   ← Impact Sounds impactWood_heavy_000.ogg
unzip -p "$CACHE/impact-sounds.zip" "Audio/impactWood_heavy_000.ogg" > "$OUT/hit.ogg"

echo "audio pipeline complete — curated files:"
for f in swing hit door; do
  printf '  %s  %s\n' "$(sha256sum "$OUT/$f.ogg" | cut -d' ' -f1)" "$OUT/$f.ogg"
done
