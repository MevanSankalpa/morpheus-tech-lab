# morpheus-tech-lab — Architecture

## System topology

A static single-page site. There is no server logic, no database and no storage: every
simulation runs in the visitor's browser tab, and closing it discards everything.

```
 maintainer: npm run deploy ─► vite build ──► dist/ ──► gh-pages branch
                                                          │  GitHub Pages
                                                          ▼
                                   lab.morpheustech.net  (public/CNAME; DNS CNAME
                                                          lab → morpheus-tech-llc.github.io)
                                                          │  static files only
 ┌──────────────────────────── Browser tab ───────────────▼─────────────────────┐
 │ index.html ── main.js ── initSimulation() ──► matrixFunctions                │
 │                              │                 generateSimulation()          │
 │                              │                        │                      │
 │   controls.js ──writes──► state (state.js) ◄── history: Grid3D[0..N]         │
 │                              │                                               │
 │   time.animate() ──► simulationModel.updatePoints() ──► Three.js Points      │
 │                                     space.js: scene, camera, OrbitControls   │
 └──────────────────────────────────────────────────────────────────────────────┘
```

The company site, https://morpheustech.net, links here, and the lab's company panel (opened
from any Morpheus Tech logo) links back to it. Nothing here calls any Morpheus service.

## Domain model

**`Grid3D`**: a dense cube of `size³` cells (`Uint8Array`) plus `active`, the list of
non-empty cells the renderer draws.

**History**: `state.simulationData`, one `Grid3D` per generation, from 0 to `generations`.
It is computed in full before playback.

**Simulation mode**: each mode turns a seed into a history.

| Mode | Space | Evolve step |
|---|---|---|
| Game of Life 3D | `size³`, 26 neighbours | `convolve3D()`: birth 9–10, survival 5–15 by default; separate corner, edge and face rules when wrapping is off |
| Rule 30 | 1D or 2D, depth 1 | `evolveRule30()`, `evolveRule30_2D()` |
| Sine wave | `size³` | `generateSineWaveGrid()`: an analytic field per generation, no state carried |
| Abelian sandpile | `size²` at `z = 0` | `evolveSandpile()`: one grain is added at the centre each generation, and cells topple above 4 |

**Seed**: a shape function from `shapeGenerators.js` (perlin, cube, tetrahedron, octahedron,
worley, rule30). Its parameters are in `state.shapeParams`.

## Data flows

**Write path (rebuild).** A control changes `state`, then `initSimulation()`:
1. `state.reset()`
2. `generateSimulation()` computes the full history
3. `buildSimulationModel()` sizes a `Points` geometry for the grid
4. The first `updatePoints()` runs, and the loading overlay hides.

**Read path (every frame).** `animate()` runs at about 60 fps. It advances `state.currentGen`
by playback speed and direction, then `updatePoints()` writes the positions and colours of that
generation's `active` cells into the geometry buffers. Orbiting, slicing and auto-rotate change
only the camera or the visible set.

## Architectural decisions

**Precompute the whole history.** It costs memory (`size³ × generations`, all at once) and a
wait up front. In return, scrubbing and reverse playback are instant and the render loop never
waits on compute.

**CPU only, on purpose.** The lab shows what is possible in plain JavaScript, readable by anyone,
and every demo is written fresh for it. A 50³ grid over 100 generations is the default because it is comfortable on a
laptop; 100³ proved too slow on the CPU.

**Vanilla JS and one state object.** Kept small enough to read in one sitting, as befits public
demo code. The lab hasn't needed more structure yet.

**Static hosting on GitHub Pages under a company subdomain.** Free, with no server to run;
`lab.morpheustech.net` keeps the lab under the company's domain while it stays a separate repo
from the company site.

**The brand is pinned, not linked, and only in part.** The lab takes `tokens.css` and the favicon
from a released `brand/v*` tag, with a hash lock; only maintainers can re-sync it. The brand's
documents and full-size logo stay private, since anything here is public. `NOTICE` keeps the
brand out of the license grant. The restyle that would use the tokens is not done yet.

**Open source under Apache-2.0, built with the community.** The code was public from the start,
under MIT through v1.4.0; from v1.5.0 it is licensed under Apache-2.0, with a `NOTICE` file.
Outside contributions come in under the same license, each commit signed off under the
Developer Certificate of Origin ([CONTRIBUTING.md](CONTRIBUTING.md)). Contributions must be
original work, with no code or internals from other projects or products, which keeps the
company's proprietary products out (see `AGENTS.md`).

**Pull requests into `development`, releases from `main`.** `main` is protected and changes only
by a release pull request from `development`; the annotated tag is the version. The rules are in
[RELEASING.md](RELEASING.md).
