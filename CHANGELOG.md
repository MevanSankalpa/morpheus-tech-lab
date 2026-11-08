# Changelog

All notable changes to the Morpheus lab (morpheus-tech-web). Versions are the annotated git tags.

## Unreleased

### Changed
- The site moves to **lab.morpheustech.net**. It is built for the domain root, and the
  `github.io` address redirects there.
- The README describes the project as the Morpheus lab.
- `package.json` carries the release version (1.3.0) instead of 0.0.0.
- `dist/` is no longer tracked; the `gh-pages` branch holds the build.

### Added
- Agent and architecture docs: `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md` and this changelog.

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
