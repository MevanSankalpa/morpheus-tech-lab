# Changelog

All notable changes to Morpheus Tech Lab (`morpheus-tech-lab`, named `morpheus-tech-web` until
2026-11-08). Versions are the annotated git tags.

## Unreleased

## [1.4.0] — 2026-11-08

### Changed
- The site moves to **lab.morpheustech.net**, built for the domain root. The repo's `github.io`
  project address redirects there; the pre-rename `…/morpheus-tech-web/` address no longer
  resolves.
- Renamed Morpheus Tech Lab, replacing "MatMagic" in the site and the README. The repo is now
  `morpheus-tech-lab`.
- `package.json` carries the release version instead of 0.0.0.
- `dist/` is no longer tracked; the `gh-pages` branch holds the build.

### Added
- Agent and architecture docs: `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md` and this changelog.
- The Morpheus Tech favicon, and the brand tokens ready for a restyle, pinned from `brand/v3.2.0`
  (`brand.lock`, `npm run brand:check`).
- `NOTICE`: the MIT License covers the code, not the Morpheus Tech name, logo or brand files.

## [1.3.0] — 2025-12-16
### Added
- Abelian sandpile mode.
- Sine wave mode.
- Configuration modal and a reworked control bar with a 3D/2D toggle.

## [1.2.0] — 2025-11-13
### Added
- Rule 30, in 1D and 2D.
- Boundary rules for corner, edge and face cells when wrapping is off.
- Flip-orientation toggle.

## [1.1.1] — 2025-11-06
### Changed
- Grid wrapping, cell size and the visual 3D grid refined.

## [1.1.0] — 2025-11-03
### Added
- Wireframe display, Perlin and Worley noise seeds, and a grid-wrap toggle.

## [1.0.0] — 2025-10-31
### Added
- Game of Life 3D on a 50³ grid, with orbit controls and playback.
