# morpheus-tech-lab — coding contract

## Module layout

```
index.html               All markup: HUD, control bar, configuration modal, info panels
public/CNAME             lab.morpheustech.net, copied into every build. Never delete
public/favicon.svg       Brand pin (see brand.lock). Never hand-edit
brand.lock               The brand tag the pin came from, and a sha256 per pinned file
NOTICE                   What MIT does not cover: the Morpheus Tech name, logo and brand files
scripts/brand.mjs        `sync` re-pins the brand from ../morpheus at a tag; `check` verifies the lock
vite.config.js           base '/', because the site is served from the domain root
src/
  main.js                Boot: initSimulation(), then animate()
  brand/tokens.css       Brand pin: the Morpheus Tech brand tokens. Not imported yet. Never hand-edit
  state.js               The one shared, mutable `state` object: settings, rules, scene handles, history
  simulationModel.js     Builds the Three.js Points geometry from the history; updatePoints() per frame
  matrixFunctions.js     The automata: generateSimulation() and each mode's evolve step
  grid3D.js              Grid3D: a dense size³ Uint8Array plus an `active` list of live cells
  shapeGenerators.js     Seed shapes: perlin, cube, tetrahedron, octahedron, worley, rule30
  space.js               Scene, camera, renderer, OrbitControls (stored on `state`)
  time.js                The animation loop, playback speed, auto-rotate; a vestigial clock history
  controls.js            All UI wiring: buttons, sliders, modal, mode switching (~1,800 lines)
  color.css, style.css   Theme colours and layout
  assets/images/         Logos, README images
```

## Core patterns

- **One state object.** Every module imports `state` from `state.js` and reads or writes it
  directly. There is no store, no events and no reactivity: a change takes effect when something
  reads it next.
- **Precompute, then play.** `initSimulation()` computes the whole history,
  `state.simulationData[0..generations]`, one `Grid3D` per generation, before anything plays.
  Playback, reverse and scrubbing only change `state.currentGen` and call `updatePoints()`.
- **Changing a setting rebuilds.** Mode, size, seed or rules all go through `initSimulation()`
  again (from `controls.js`).
- **Mode flags.** `state.simulationMode` names the mode, and the booleans `useRule30`,
  `useRule30_2D`, `useSineWave` and `useSandpile` steer `generateSimulation()`. Size and
  generations are remembered per mode in `state.modeValues`.

## Invariants

- `Grid3D` index is `x + y*size + z*size²`. `data` and `active` must agree. Write through
  `set()`, or rebuild `active` after writing `data` directly (as the sandpile does).
- Rule 30 has depth 1 and the sandpile lives in the `z = 0` plane, with heights capped at 255.
  Rendering reads `matrixDepth` for that.
- Game of Life 3D boundary rules (corner, edge, face) apply only when grid wrapping is off.
  Isolation and overcrowding are always derived from survival, never set by hand.
- `state.reset()` keeps the scene, renderer and camera, so a rebuild reuses one WebGL context.
- `public/CNAME` and `base: '/'` go together. Without both, the deployed site breaks.
- Pinned brand files match `brand.lock`; `npm run build` refuses to build otherwise. To change
  one, change the brand in `~/morpheus/design/brand/`, release a `brand/v*` tag, and re-sync.

## Risky operations

- **`npm run deploy` publishes to the world immediately.** Only the developer runs it, from `main`.
- **Memory is `size³ × generations` bytes**, all held at once. Raising the size or generation
  limits can freeze or crash a visitor's tab; test at the new maximums before raising them.
- `controls.js` re-inits on almost every input. A change there easily triggers double rebuilds.

## What NOT to do

- **Never bring in code from matmagic or Observatory**, or describe how they work: no WebGPU, WGSL,
  NCA, graph, force or planetarium layout. This is public, MIT-licensed code; anything committed
  is given away and disclosed. Write new demos from scratch, for the CPU.
- No secrets, tokens, internal hostnames or private paths. The repo and the site are public.
- Don't commit `dist/` (ignored); `gh-pages` holds the build.
- Don't pin the brand's documents (`DESIGN_SYSTEM.md`, `design_tokens.json`, `DOCTRINE.md`) or
  the full-size logo here: they stay private in the org repo. Read them there.
- Don't copy scripts from the company sites either. They are proprietary too; `scripts/brand.mjs`
  was written fresh for this repo.
- Don't add a framework or a backend for a demo. The lab stays a static site.

## Known debt

`console.log` runs on every frame in `updatePoints()` and on every generation. `time.js`
still computes a clock history that nothing displays. `index.html` carries many inline styles.

## End-of-session obligations

- New or changed simulation mode or seed: update `README.md` (Simulation modes) and
  `ARCHITECTURE.md` (Domain model).
- New module or data flow: update the module layout here and `ARCHITECTURE.md`.
- New rule or risk: add it here.
- User-visible change: add a line under Unreleased in `CHANGELOG.md`.
