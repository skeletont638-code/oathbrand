# OATHBRAND v1.0.0

**A 30-minute PS1-style dark fantasy that runs in your browser. The kingdom is dead. The oath is not.**

▶ **Play free — no download:** https://skeletont638-code.github.io/oathbrand/

You are the last knight whose brand still burns. A hundred years after the fire that held the kingdom went out, a voice you have no reason to trust sends you back through the gate to keep an oath everyone else laid down. Walk the ruins, cross blades with what your friends became, and carry a crown up a dead mountain to the thing that lent it.

## What's in it

- **Seven hand-authored zones**, from the Ashen Gate to the Summit, in a hand-written PS1 renderer (320×240 internal resolution, vertex wobble, affine texture warping, dithered RGB555 colour).
- **Melee combat** — light and heavy attacks, a guard, and a quick step — against soldiers, archers, wraiths, and a named boss, the Forsworn.
- **The Oath-Brand.** Your embers are your lives. Burn too many and you *hollow*: the world loses its colour, the dead stop fearing you, and you keep going.
- **Four endings.** The oath can be kept, broken, or forgotten — and there is a fourth that the first run never offers.
- **The Second Vigil (New Game+).** Finish once and the kingdom begins again, one shade darker: enemies moved to worse ground, new inscriptions that recast what you thought you knew, and a hidden way through a wall that was never open before — the path to the fourth ending.
- **Full audio** — layered ambience and music, most of it synthesized live in the browser.
- **Kneel at a banner** to rekindle, save, and glimpse who stood there before. It's the only checkpoint.

## Controls

Best played on a desktop. **WASD / arrows** move, the **mouse** looks (click to lock the pointer), **left / right mouse** are light / heavy attacks, **Shift** guards, **Space** steps, and **E** interacts. **Esc** pauses. Touch controls cover moving, looking, and interacting.

## Known rough edges

- **Mobile/touch combat is unfinished.** Touch handles movement, looking, and interaction, but there are no on-screen attack, guard, or dodge controls yet — the fights want a keyboard and mouse. Explore on a phone; fight on a desktop.
- **Performance** is tuned by draw-call budget (every zone stays well under 100 calls) rather than measured across many GPUs; a very old phone may drop below 60 fps.

## Under the hood

Three.js · TypeScript · Vite, no game engine — a ~210 KB gzipped bundle, 486 unit tests, and a browser smoke test on every push. The self-contained PS1 pipeline is documented and built to be reused: `src/ps1/README.md`. All art and audio are CC0 or OFL; full credited manifest in `assets/LICENSES.md`.

OATHBRAND was built as an experiment in AI-assisted game development, in collaboration with Claude (Anthropic), and is a companion piece to *Iron Oath*, an upcoming AI-animated anime series set in the same dead kingdom.

**Keep the vigil.**
