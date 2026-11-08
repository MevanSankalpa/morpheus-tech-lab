<p align="center">
  <a href="https://lab.morpheustech.net/" target="_blank" rel="noopener noreferrer">
    <img src="src/assets/images/game-of-life-screenshot-readme.png" alt="Logo" width="200" height="200">
  </a>
</p>

<h1 align="center">Morpheus Tech Lab</h1>

<p align="center">
  <img src="src/assets/images/morpheus-tech.png" alt="Morpheus Tech" width="120px"/>
</p>

<div align="center">

| | |
|----------------------|--------------------------|
| **Creator:** | <a href="https://github.com/wmauz677" target="_blank" rel="noopener noreferrer">Weston Mauz</a> |
| **Company:** | Morpheus Tech LLC |
| **Release:** | v1.4.0 - November 8th, 2026 |
| **Lab** | <a href="https://lab.morpheustech.net/" target="_blank" rel="noopener noreferrer">lab.morpheustech.net</a> |
| **Company** | <a href="https://morpheustech.net/" target="_blank" rel="noopener noreferrer">morpheustech.net</a> |

</div>

### Project Index:

1. [Mission Statement](#1-mission-statement)
2. [Rules](#2-rules)
3. [Design Methodology](#3-design-methodology)
4. [Status](#4-status)
5. [Next Steps](#5-next-steps)
6. [Run Locally](#6-run-locally)
7. [License](#7-license)
8. [Attributions](#8-attributions)

## 1. Mission Statement

This is **Morpheus Tech Lab**: interactive demos of what Morpheus Tech builds, free to use in
your browser at <a href="https://lab.morpheustech.net/" target="_blank" rel="noopener noreferrer">lab.morpheustech.net</a>.
It began by re-imagining <a href="https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life" target="_blank" rel="noopener noreferrer">Conway's Game of Life</a>
in three dimensions, and it now holds several 3D cellular automata you can seed, play, rewind,
slice and orbit. Everything runs on your own computer; nothing is sent anywhere.

The lab is open source under the MIT License. Morpheus Tech's products, such as matmagic, are
built on this beginning and go further. They are developed separately.

## 2. Rules

The original 2D rules are shown next to the new, reimagined 3D rules that are used in this project.

| Rule                        | Description                                                                                | 2D (Conway’s) | Visualization [1] | 3D |
| ---------------------------- | ------------------------------------------------------------------------------------------ | -------------- | ---------------- | --- |
| **Birth**                   | If a cell has exactly ***x*** living neighbors and is<br>initially dead, it becomes alive. | 3              | <img src="src/assets/images/rule_birth.png" alt="2D Birth" width="200" height="100"> | 9, 10 |
| **Survival**                | If a cell has ***[x,y,z]*** living neighbors, it<br>stays alive in the next generation.    | 2, 3           | <img src="src/assets/images/rule_survival.png" alt="2D Survival" width="200" height="100"> | 5–15 |
| **Death by Isolation**      | If a cell has fewer than ***x*** living<br>neighbors, it dies (becomes dead).              | 2              | <img src="src/assets/images/rule_death_isolation.png" alt="2D Death Isolation" width="200" height="100"> | 5 |
| **Death by Overcrowding**   | If a cell has more than ***x*** living neighbors, it dies.                                 | 3              | <img src="src/assets/images/rule_death_overpopulation.png" alt="2D Overcrowding" width="200" height="100"> | 11 |


### State Transition Table

| Current State | Conway’s Life – Living Neighbors | 3D Life – Living Neighbors | Next State | Rule Triggered / Reason       |
|---------------|----------------------------------|----------------------------|------------|-------------------------------|
| `1` (Alive)   | 0 – 1                            | 0 – 4                      | `0`        | **Dies** — underpopulation    |
| `1` (Alive)   | **2 – 3**                        | **5 – 15**                 | `1`        | **Survives / Lives**          |
| `1` (Alive)   | 4 – 8                            | 16 – 26                    | `0`        | **Dies** — overcrowding       |
| `0` (Dead)    | 0 – 2                            | 0 – 8                      | `0`        | Not enough neighbors / no birth |
| `0` (Dead)    | **3**                            | **9 – 10**                 | `1`        | **Birth / Reproduction**      |
| `0` (Dead)    | 4 – 8                            | 12 – 26                    | `0`        | Overcrowded — no birth        |

## 3. Design Methodology

### Tools
This project was built with vanilla javascript with the addition of the <a href="https://threejs.org" target="_blank" rel="noopener noreferrer">three.js</a> library. <a href="https://cursor.com" target="_blank" rel="noopener noreferrer">Cursor</a>, <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">ChatGPT</a>, & <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer">Claude</a> were used to assist with writing code, researching mathematical concepts, & brainstorming different ideas. This was programmed on an M4 <a href="https://www.apple.com/mac-mini/" target="_blank" rel="noopener noreferrer">Mac Mini</a> & M1 <a href="https://www.apple.com/shop/buy-mac/macbook-air" target="_blank" rel="noopener noreferrer">Macbook Air</a> using MacOS.

### Resources
Much of the inspiration for the design for this project was from <a href="https://www.youtube.com/@3blue1brown" target="_blank" rel="noopener noreferrer">3Blue1Brown</a>, specifically the course <a href="https://www.youtube.com/watch?v=fNk_zzaMoSs&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab" target="_blank" rel="noopener noreferrer">Essence of linear algebra</a>. Further inspiration came from the <a href="https://lexfridman.com/podcast/" target="_blank" rel="noopener noreferrer">Lex Friedman Podcast</a>, specifically conversations with <a href="https://www.youtube.com/watch?v=ez773teNFYA" target="_blank" rel="noopener noreferrer">Stephen Wolfram</a> & <a href="https://www.youtube.com/watch?v=YDjOS0VHEr4" target="_blank" rel="noopener noreferrer">Neil Gershenfeld</a>. Two Game of Life websites also helped formulate the UI, such as <a href="https://playgameoflife.com" target="_blank" rel="noopener noreferrer">Play Game of Life</a> & <a href="https://conwaylife.com" target="_blank" rel="noopener noreferrer">Conway Life</a>. Finally, an interview of Conway himself, by <a href="https://www.youtube.com/watch?v=R9Plq-D1gEk" target="_blank" rel="noopener noreferrer">Numberphile</a>.

### Process
The original idea began on pen-and-paper, starting with a 3D drawing representing a 3D cube made of cubes (see company logo). 



The 3D model was determined to be best represented mathematically by a three dimensional matrix, as linear algebra can be leveraged for computational efficiency. The idea was then delivered to various LLM to build a prototype of the software in Python. That prototype, was then reviewed & re-written line-by-line by a human software engineer. That version was then translated to javascript by an LLM, then passed back to the human engineer to be re-written manually, again. There were many iterations & refactors performed by handing off between LLM & human engineer. The end goal of this process was to deliver software that was clearly human readable & followed software development best practices.

<p align="center">
  <img src="src/assets/images/game-of-life-3d-drawing.png" alt="drawing" height="400">
</p>

## 4. Status

### Simulation modes

| Mode | What you see |
|---|---|
| **Game of Life 3D** | Conway's rules extended to a cube, where each cell has 26 neighbours (rules above). Edge, face and corner cells get their own rules when the grid doesn't wrap |
| **Rule 30** | Wolfram's elementary automaton, in 1D or 2D |
| **Sine Wave** | A continuous wave field, a smooth visual reference |
| **Abelian Sandpile** | One grain of sand dropped at the centre each generation; piles topple and spread into fractal patterns |

Seeds: cube, tetrahedron, octahedron, Perlin noise and Worley noise. The default is a 50×50×50
grid over 100 generations. The whole run is computed before it plays, so you can scrub and play
it backwards instantly.

### Limits
Everything runs on your CPU. A 100×100×100 grid (one million cells) over more than 100
generations is more than a typical laptop handles comfortably.

## 5. Next Steps
More demos are coming to the lab. Feedback is welcome, so please reach out or tag us in your content.

### Ideas

| # | Feature | Description |
|---|----------|-------------|
| 1 | **Upload Starting Seed** | Start from your own seed: a CSV matrix, voxels, or a converted 3D file |
| 2 | **More automata** | New rule families, each a demo of its own |

## 6. Run Locally

Requires Node.js 20.19 or newer (for Vite 7).

1. Clone the repository
2. `npm install`
3. `npm run dev`, then open http://localhost:5180

`npm run build` writes the production site to `dist/`, and `npm run preview` serves it. There are
no automated tests yet. Releases are published to GitHub Pages with `npm run deploy` by the
maintainer; see `CHANGELOG.md` for what each version changed.


## 7. License

The code is distributed under the MIT License; see `LICENSE`. The Morpheus Tech name, logo and
brand files are not covered by it; see `NOTICE`.

## 8. Attributions

[1] Conway's Game of Life Rules -- 2D Visualization: <a href="https://playgameoflife.com/info" target="_blank" rel="noopener noreferrer">https://playgameoflife.com/info</a>