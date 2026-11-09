# morpheus-tech-lab — coding contract

For people and agents changing code. The contributor workflow (setup, branches, DCO sign-off,
changelog) is in [CONTRIBUTING.md](CONTRIBUTING.md); branches, versions and releases are in
[RELEASING.md](RELEASING.md).

## Module layout

```
.github/workflows/ci.yml The `build` (npm ci, npm run build) and `DCO` (sign-off) checks, required on main
.github/ISSUE_TEMPLATE/  Issue forms: bug_report.yml, idea.yml; config.yml turns off blank issues and links Discussions (GitHub adds the security-report entry itself)
.github/pull_request_template.md  The pull-request checklist: targets development, signed off, changelog line, build passes
index.html               All markup: HUD, control bar, configuration modal, info panels
public/CNAME             lab.morpheustech.net, copied into every build. Never delete
public/favicon.svg       Brand pin (see brand.lock). Never hand-edit
brand.lock               The brand tag the pin came from, and a sha256 per pinned file
LICENSE                  Apache License 2.0 (MIT through v1.4.0)
NOTICE                   Copyright notice, and what the license does not cover: the Morpheus Tech name, logo and brand files
CONTRIBUTING.md          How to contribute: setup, branches, DCO sign-off, changelog
CODE_OF_CONDUCT.md       Contributor Covenant 2.1, unmodified apart from the enforcement contact
SECURITY.md              Supported versions (latest only) and private vulnerability reporting
ROADMAP.md               The public roadmap: the engine, new demos, the brand restyle, community
RELEASING.md             Branches, versions, changelog format and the release steps
CHANGELOG.md             What each version changed (Keep a Changelog)
scripts/brand.mjs        `sync --org <brand repo>` re-pins the brand at a tag (maintainers); `check` verifies the lock
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
- Pinned brand files match `brand.lock`; `npm run build` refuses to build otherwise. Only
  maintainers change one: they change the brand at its source, release a `brand/v*` tag, and
  re-sync with `npm run brand:sync`. Never edit a pinned file here.

## Risky operations

- **`npm run deploy` publishes to the world immediately.** Only a maintainer runs it, from `main`,
  as a step of [RELEASING.md](RELEASING.md). Agents never deploy.
- **Memory is `size³ × generations` bytes**, all held at once. Raising the size or generation
  limits can freeze or crash a visitor's tab; test at the new maximums before raising them.
- `controls.js` re-inits on almost every input. A change there easily triggers double rebuilds.

## What NOT to do

- **Don't edit files while `main` is checked out.** Before the first edit, check
  `git branch --show-current`. A deploy may have left the checkout on `main`: switch to
  `development` (`git switch development && git pull --ff-only`) before changing anything, and
  leave the checkout on `development` when you finish.

- **Contributions must be original work; no code or internals from other projects or
  products**, including Morpheus Tech's other, proprietary products: don't copy, port or describe
  them. This is public, Apache-2.0-licensed code; anything committed is given away and disclosed.
  Write new demos from scratch, for the CPU. Libraries come in as npm dependencies, not copies.
- No secrets, tokens, internal hostnames, or paths outside this repo. The repo and the site are
  public.
- Don't commit `dist/` (ignored); `gh-pages` holds the build.
- Don't add brand files beyond the two pinned in `brand.lock`: the brand's design documents and
  the full-size logo stay private.
- Don't copy scripts from the company's other sites either. They are proprietary too;
  `scripts/brand.mjs` was written fresh for this repo.
- Don't add a framework or a backend for a demo. The lab stays a static site.

## Known debt

`console.log` runs on every frame in `updatePoints()` and on every generation. `time.js`
still computes a clock history that nothing displays. `index.html` carries many inline styles.

## End-of-session obligations

- New or changed simulation mode or seed: update `README.md` (Simulation modes) and
  `ARCHITECTURE.md` (Domain model).
- New module or data flow: update the module layout here and `ARCHITECTURE.md`.
- New rule or risk: add it here.
- User-visible change: add a line under `## [Unreleased]` in `CHANGELOG.md`.
- Release prep, when asked: draft the prep changes in [RELEASING.md](RELEASING.md) (step 2) as
  file edits only. Maintainers commit, merge, tag and deploy.
