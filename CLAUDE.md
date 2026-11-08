# morpheus-tech-lab — Morpheus Tech Lab

The public, open-source (MIT) demo site of Morpheus Tech LLC. Visitors use interactive 3D
cellular automata: Game of Life 3D, Rule 30, an Abelian sandpile and a sine wave. They run in
the browser on the CPU. Its job is to show what Morpheus software can do and to market the
company's products. It is served at **lab.morpheustech.net** and linked from the company site.

**Before writing any code, read [AGENTS.md](AGENTS.md).** It is the coding contract, including the
one rule that matters most here: what may never enter this repo.

## This repo is public

Everything committed here is published: the source on GitHub, the build on the open web. It is
the org's one open-source exception, approved by the owner on 2026-11-08
(`~/morpheus/canon/repo-categories.md` → Open-source exceptions).

- **Code flows one way: out of this repo, never into it.** matmagic (`~/matmagic`) was forked
  from here on 2025-12-20 and is proprietary. Nothing it added since (WebGPU compute, WGSL, NCA)
  and nothing from Observatory (`~/aquila/observatory`: its graph, force or planetarium layout)
  may be copied, ported or described here. A demo of a product shows *what* it does, as a video,
  screenshots or a toy written fresh for the lab, never *how*.
- No secrets, no `.env`, no internal hostnames (`*.aquila.lan`), no private repo paths in
  anything that ships.

## Lifecycle

| Command | Does |
|---|---|
| `npm install` | Install dependencies (first run) |
| `npm run dev` | Vite dev server, http://localhost:5180 (registered in `~/aquila/docs/ports.md`) |
| `npm run build` | Check the brand pin, then build to `dist/` (not tracked) |
| `npm run preview` | Serve the built `dist/` locally, also on 5180 |
| `npm run deploy` | Build, then publish `dist/` to the `gh-pages` branch, which is live at once |
| `npm run brand:check` | Fail if a pinned brand file no longer matches `brand.lock` |
| `npm run brand:sync -- brand/vX.Y.Z` | Re-pin the brand from `../morpheus` at a released tag |

There is no backend, database, backup or log path, and there are no environment variables. A
release, run by the developer: merge `development` into `main`, tag `vX.Y.Z` (annotated), and run
`npm run deploy` from `main`. Agents never deploy, since a deploy is a public release.

## Stack

- Vanilla JavaScript (ES modules), no framework, no TypeScript.
- Three.js for rendering (`Points` cloud and `OrbitControls`).
- Vite for build and dev. `gh-pages` for deploy.
- No tests yet.

## Branches and versions

`main` is the release branch, `development` the working branch, and `gh-pages` the deployed build
(never edited by hand). The annotated tag `vX.Y.Z` is the version; `package.json` mirrors it.
Org rules: `~/morpheus/canon/branching.md` and `~/morpheus/canon/versioning.md`.

## Org

This repo answers to the Morpheus org canon (`~/morpheus/canon/index.md`). Plans for it live in
`~/morpheus/plans/sites/`, never here. Agents do no version control unless asked.
