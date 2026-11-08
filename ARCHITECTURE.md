# morpheus-tech-lab — Architecture

## System topology

A static single-page site. There is no server logic, no database and no storage: every
simulation runs in the visitor's browser tab, and closing it discards everything.

```
 developer: npm run deploy ──► vite build ──► dist/ ──► gh-pages branch
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

The company site (`~/morpheus-tech-llc`, morpheustech.net) links here. Nothing here calls any
Morpheus service.

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
waits on compute. matmagic inherited this choice.

**CPU only, on purpose.** The lab shows what is possible. The GPU engine is matmagic's and stays
proprietary. A 50³ grid over 100 generations is the default because it is comfortable on a
laptop; 100³ proved too slow on the CPU.

**Vanilla JS and one state object.** Kept small enough to read in one sitting, as befits public
demo code. matmagic later split state into hot and cold tiers when it grew. The lab hasn't needed
that.

**Static hosting on GitHub Pages under a company subdomain.** Free, with no server to run;
`lab.morpheustech.net` keeps the lab under the company's domain while it stays a separate repo
from the company site.

**The brand is pinned, not linked, and only in part.** The lab takes `tokens.css` and the favicon
from a released `brand/v*` tag, with a hash lock, as the company site does. The brand's documents
and full-size logo stay in the private org repo, since anything here is public. `NOTICE` keeps the
brand out of the MIT grant. The restyle that would use the tokens is not done yet.

**Open source (MIT), as the org's one exception.** The code was public from the start. It stays
public as the open face of the company's work, and the one-way rule (see `CLAUDE.md`) keeps
product code out.
