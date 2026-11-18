// SPDX-License-Identifier: Apache-2.0
//
// The Contests panel (#77), in the middle of the screen: the list of contests, a contest's page,
// its run (a clock, a chart of the generations over time and the statistics, nothing drawn in
// 3D), its results card,
// Submit by email, and Verify a result; and each contest's Hall of Fame (#79). It also keeps the
// HUD's Contest section up to date. Watch (watch.js, #78) hides it, plays a result back in 3D,
// and brings it back on Close.
//
// Text from a result file comes from strangers, so the panel only ever sets textContent: nothing
// from a file is parsed as HTML. What it says is worked out in format.js, and a run is
// speed.js's SpeedRun.

import { CONTESTS } from '../unbounded/contests.js';
import { MAX_RESULT_BYTES, readResult, ResultError } from '../unbounded/canonical.js';
import hallOfFameData from '../unbounded/hall-of-fame.json';
import labLogo from '../assets/images/morpheus-tech.png';
import { detectBrowser } from '../browser.js';
import { writeJsonFile, download } from '../explore/explore.js';
import { SpeedRun, verifyInWorker } from './speed.js';
import { openWatch, closeWatch } from './watch.js';
import {
  n, rulesText, countdownText, chartLayout, speedHero, speedScoreText, speedEndingText, resultFileName,
  statsRows, verdictTitle, closingText, scoreText, boardScore,
} from './format.js';
import { SUBMIT_ADDRESS, emailSubject, emailBody, mailtoLink } from './submit.js';
import { HALL_OF_FAME_TOP, readHallOfFame, rankEntries, dayText } from './hallOfFame.js';
import { LOOKS, logo, verifyGlyph } from './looks.js';

const ISSUES = 'https://github.com/Morpheus-Tech-LLC/morpheus-tech-lab/issues/';
/**
 * The kinds of contest this page can run. Methuselah is defined in contests.js (#93) and verifies,
 * but its page comes with #94; until then it stays in COMING.
 */
const ON_PAGE = ['speed'];
/** The contests still to come, shown in the list without an Open button. */
const COMING = [
  { kind: 'methuselah', title: 'Methuselah', about: 'The longest-lived pattern that settles inside an arena', issue: 41 },
  { kind: 'contained-chaos', title: 'Contained chaos', about: 'A pattern that never settles and never escapes', issue: 42 },
];
const SELF_REPORTED = 'The time is measured by your own browser, on your own machine. Replaying a result proves '
  + 'that its generation is right, but not how long it took, so the Speed board is self-reported.';

const panel = {
  open: false,
  contest: null,
  run: null, // the SpeedRun on screen, until the panel moves on
  startedAt: 0, // when the Worker started the run, on the page's clock, for the countdown
  verify: null, // the check in progress: {cancel}
  view: null, // 'list', 'contest', 'running', 'results', 'verifying', 'verdict'
};

const el = (id) => document.getElementById(id);

/**
 * An element: h('p', {className: 'x', text: 'y'}, child, …). Text is always set as text.
 * @param {string} tag
 * @param {object} [props] - className, text, onclick, and attributes in `attrs`
 */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.onclick) node.onclick = props.onclick;
  for (const [name, value] of Object.entries(props.attrs ?? {})) node.setAttribute(name, value);
  node.append(...children.filter(Boolean));
  return node;
}

function button(text, onclick, { main = false, id } = {}) {
  const attrs = { type: 'button' };
  if (id) attrs.id = id;
  return h('button', { className: `glass-button contests-button${main ? ' contests-button--main' : ''}`, text, onclick, attrs });
}

/**
 * Verify a result's button: the scales, what it does, and a line on how. It judges every
 * contest's entries, so it looks the same wherever it appears.
 */
function verifyButton(label = 'Verify a result', { wide = false } = {}) {
  return h('button', {
    className: `contests-verify-button${wide ? ' contests-verify-button--wide' : ''}`,
    onclick: chooseFile,
    attrs: { type: 'button', id: 'contests-verify' },
  },
  verifyGlyph(wide ? 28 : 20),
  h('span', { className: 'contests-verify-text' },
    h('span', { className: 'contests-verify-label', text: label }),
    wide ? h('span', { className: 'contests-verify-sub', text: 'Replay a result file from any branch to check it, in your browser' }) : null));
}

/** A definition list of [label, value] rows; values given as nodes are kept, ids too. */
function facts(rows, idPrefix) {
  const list = h('dl', { className: 'contests-facts' });
  rows.forEach(([label, value], i) => {
    const dd = h('dd', {}, typeof value === 'string' ? document.createTextNode(value) : value);
    if (idPrefix) dd.id = `${idPrefix}-${i}`;
    list.append(h('dt', { text: label }), dd);
  });
  return list;
}

/** Replaces the panel's contents with a view, and focuses its main button. */
function show(view, title, nodes) {
  panel.view = view;
  el('contests-panel-title').textContent = title;
  el('contests-panel-body').replaceChildren(...nodes.filter(Boolean));
  status('');
  const body = el('contests-panel-body');
  const main = body.querySelector('.contests-button--main:not([disabled])') ?? body.querySelector('button:not([disabled])');
  main?.focus({ preventScroll: true });
}

function status(text) {
  el('contests-panel-status').textContent = text;
}

function hud(name, state, generation) {
  if (name !== undefined) el('contest-hud-name').textContent = name;
  if (state !== undefined) el('contest-hud-status').textContent = state;
  if (generation !== undefined) el('contest-hud-generation').textContent = generation;
}

// ---- Opening and closing ----

/** Shows the panel, on the list of contests. */
export function openPanel() {
  panel.open = true;
  el('contests-panel').hidden = false;
  const input = el('contests-verify-file');
  input.onchange = () => {
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still counts as a change
    if (file) verifyFile(file);
  };
  showList();
}

/** Hides the panel, ending any run or check: for leaving the mode. */
export function closePanel() {
  panel.open = false;
  closeWatch({ quietly: true });
  endRun();
  cancelVerify();
  el('contests-panel').hidden = true;
  el('contests-panel-body').replaceChildren();
  panel.view = null;
}

/**
 * Each frame: the clock follows the page's clock between the Worker's statistics. Its arc
 * empties over the run's seconds; the Worker's own clock decides the score.
 */
export function panelFrame(now) {
  if (panel.view !== 'running' || !panel.startedAt) return;
  const elapsed = now - panel.startedAt;
  const value = el('contests-countdown');
  if (value) value.textContent = countdownText(panel.run.seconds, elapsed);
  const arc = el('contests-clock-arc');
  if (arc) arc.style.strokeDashoffset = String(Math.min(100, (elapsed / (panel.run.seconds * 1000)) * 100));
}

function endRun() {
  panel.run?.close();
  panel.run = null;
  panel.startedAt = 0;
}

function cancelVerify() {
  panel.verify?.cancel();
  panel.verify = null;
}

// ---- The list ----

/** A contest's square card: its logo in its colour, its name and what it measures. */
function tile(kind, title, about, footer, { open, id } = {}) {
  const color = LOOKS[kind].color;
  const parts = [
    logo(kind, 56, 'contests-tile-logo'),
    h('span', { className: 'contests-tile-name', text: title }),
    h('span', { className: 'contests-tile-about', text: about }),
    footer,
  ];
  const node = open
    ? h('button', { className: 'contests-tile', onclick: open, attrs: { type: 'button', id } }, ...parts)
    : h('div', { className: 'contests-tile contests-tile--coming' }, ...parts);
  node.style.setProperty('--contest-color', color);
  return node;
}

function showList() {
  endRun();
  cancelVerify();
  panel.contest = null;
  hud('–', 'Choosing', '–');
  const tiles = h('div', { className: 'contests-tiles' });
  for (const contest of CONTESTS.filter((c) => ON_PAGE.includes(c.kind))) {
    tiles.append(tile(contest.kind, contest.title, contest.summary,
      h('span', { className: 'contests-tile-foot', text: 'Open' }),
      { open: () => showContest(contest), id: `contests-open-${contest.id}` }));
  }
  for (const coming of COMING) {
    tiles.append(tile(coming.kind, coming.title, coming.about,
      h('span', { className: 'contests-tile-foot' },
        h('span', { className: 'contests-tag', text: 'Coming' }),
        document.createTextNode(' '),
        h('a', { text: `#${coming.issue}`, attrs: { href: `${ISSUES}${coming.issue}`, target: '_blank', rel: 'noopener' } }))));
  }
  show('list', 'The Contest', [
    h('p', { text: 'One contest, in three branches. Each branch fixes its own rules, so everyone in it runs the same thing, and any result can be checked by anyone, by replaying it, in the lab or with scripts/verify.mjs.' }),
    h('p', { className: 'contests-closes', text: closingText(CONTESTS), attrs: { id: 'contests-closes' } }),
    tiles,
    // Verify a result judges every contest: a bar across the panel under its own heading, apart
    // from the contests' cards
    h('div', { className: 'contests-judge' },
      h('span', { className: 'contests-judge-title', text: 'For every branch' }),
      verifyButton('Verify a result', { wide: true })),
  ]);
}

// ---- A contest's page ----

/** A titled area of a contest's page. */
function section(title, ...children) {
  return h('section', { className: 'contests-section' }, h('h3', { className: 'contests-section-title', text: title }), ...children);
}

/** One fact about the run, as a tile: what it is, the value, and a line about it. */
function factTile(label, value, about) {
  return h('div', { className: 'contests-fact' },
    h('span', { className: 'contests-fact-label', text: label }),
    h('span', { className: 'contests-fact-value', text: value }),
    h('span', { className: 'contests-fact-about', text: about }));
}

function showContest(contest) {
  endRun();
  panel.contest = contest;
  hud(contest.title, 'Ready', '–');
  const { fixes } = contest;
  const { birth, survival } = fixes.rules;
  const range = (list) => (list.length > 1 ? `${list[0]}–${list[list.length - 1]}` : String(list[0]));
  const run = h('button', {
    className: 'contests-run-button',
    onclick: () => startRun(contest),
    attrs: { type: 'button', id: 'contests-run' },
  },
  h('span', { className: 'contests-run-icon', attrs: { 'aria-hidden': 'true' } }),
  h('span', { className: 'contests-run-text' },
    h('span', { className: 'contests-run-label', text: `Run ${contest.title}` }),
    h('span', { className: 'contests-run-sub', text: `${contest.seconds} seconds, on your machine` })));
  const header = h('div', { className: 'contests-page-head' },
    logo(contest.kind, 64, 'contests-page-logo'),
    h('div', {},
      h('p', { className: 'contests-page-kicker', text: 'A branch of the contest' }),
      h('p', { className: 'contests-page-summary', text: `${contest.summary}.` }),
      h('p', { className: 'contests-closes', text: closingText([contest]) })));
  header.style.setProperty('--contest-color', LOOKS[contest.kind].color);
  show('contest', contest.title, [
    header,
    run,
    section('What everyone runs',
      h('div', { className: 'contests-facts-grid' },
        factTile('Seed', 'Cube10', `All ${n(fixes.seed.length)} cells of the 10³ seed box, cells −5 to 4 on each axis`),
        factTile('Rules', rulesText(fixes.rules), `A cell is born with ${range(birth)} live neighbours, and survives with ${range(survival)}`),
        factTile('Time', `${contest.seconds} seconds`, 'Timed by your own browser'),
        factTile('Ceiling', `${n(contest.ceiling)} generations`, 'A run that reaches it sooner also scores its time'))),
    hallOfFame(contest),
    section('How it runs',
      h('p', { text: `On the CPU, in a background thread (a Web Worker), with chunks of ${contest.chunkSize}³ cells, so every entrant runs the same engine. Nothing is drawn while it runs, so the run has your machine to itself. Your score is the generations completed in the ${contest.seconds} seconds. Runs that reach the ceiling of ${n(contest.ceiling)} all have the same generations, so they rank by the time they took, to the millisecond.` })),
    section('Fair play',
      h('p', { className: 'contests-note', text: SELF_REPORTED })),
    h('div', { className: 'contests-actions' },
      verifyButton(),
      button('Back', showList, { id: 'contests-back' })),
  ]);
  run.focus({ preventScroll: true });
}

// ---- The Hall of Fame ----

/** Where the site serves a file from public/: the Hall of Fame's paths are written without it. */
const served = (path) => `${import.meta.env.BASE_URL}${path}`;

/**
 * A contest's Hall of Fame: its top entries, best first, from hall-of-fame.json, or that there
 * are none yet. Names come from entrants, so they are set as text, like everything else.
 */
function hallOfFame(contest) {
  let entries;
  try {
    entries = rankEntries(readHallOfFame(hallOfFameData), contest);
  } catch (err) {
    return section('Hall of Fame', h('p', { className: 'contests-note', text: `The Hall of Fame couldn't be read: ${err.message}` }));
  }
  if (!entries.length) {
    return section('Hall of Fame', h('p', {
      className: 'contests-hof-empty',
      text: `No entries yet. Run ${contest.title}, then Submit by email from your results card: once verified, entries are listed here.`,
      attrs: { id: 'contests-hof-empty' },
    }));
  }
  const top = entries.slice(0, HALL_OF_FAME_TOP);
  return section('Hall of Fame',
    h('ol', { className: 'contests-hof', attrs: { id: 'contests-hof' } }, ...top.map((entry, i) => hallOfFameRow(entry, i + 1, contest))),
    entries.length > top.length ? h('p', { className: 'contests-note', text: `The top ${top.length} of ${n(entries.length)} entries.` }) : null);
}

/** One entry: its place, picture (or the lab's logo), name, browser and date, score, and Watch. */
function hallOfFameRow(entry, place, contest) {
  const picture = h('img', {
    className: 'contests-hof-picture',
    attrs: { src: entry.picture ? served(entry.picture) : labLogo, alt: '', width: '40', height: '40', loading: 'lazy', decoding: 'async' },
  });
  // A picture that doesn't load gives way to the logo
  picture.onerror = () => {
    picture.onerror = null;
    picture.src = labLogo;
  };
  if (!entry.picture) picture.classList.add('contests-hof-picture--logo');
  const score = scoreText(contest, entry.score);
  const watch = button('Watch', null, { id: `contests-hof-watch-${place}` });
  watch.onclick = () => watchEntry(entry, `Hall of Fame: ${entry.name}, ${score}`, watch);
  watch.setAttribute('aria-label', `Watch ${entry.name}'s run`);
  const browser = entry.browser ? `${entry.browser.name} ${entry.browser.version}` : 'Browser not given';
  return h('li', { className: 'contests-hof-entry' },
    h('span', { className: 'contests-hof-place', text: String(place) }),
    picture,
    h('span', { className: 'contests-hof-who' },
      h('span', { className: 'contests-hof-name', text: entry.name }),
      h('span', { className: 'contests-hof-meta', text: `${browser} · ${dayText(entry.date)}` })),
    hallOfFameScore(contest, entry.score),
    watch);
}

/** An entry's score: what ranks it, then the rest; at Speed's ceiling, the time leads. */
function hallOfFameScore(contest, score) {
  const { main, detail } = boardScore(contest, score);
  return h('span', { className: 'contests-hof-score' },
    h('span', { className: 'contests-hof-score-main', text: main }),
    detail ? h('span', { className: 'contests-hof-score-detail', text: detail }) : null);
}

/**
 * Loads an entry's result file from the site, reads it as untrusted data like any other, and
 * plays it in Watch.
 */
async function watchEntry(entry, title, from) {
  const view = panel.view;
  status("Loading the entry's result file…");
  let result;
  try {
    const response = await fetch(served(entry.result));
    if (!response.ok) throw new Error(`the site answered ${response.status}.`);
    const text = await response.text();
    if (text.length > MAX_RESULT_BYTES) throw new Error(`it is larger than ${MAX_RESULT_BYTES / 1024 / 1024} MB.`);
    result = readResult(text);
  } catch (err) {
    if (panel.view === view) status(`It can't be watched: ${err?.message ?? err}`);
    return;
  }
  if (panel.view !== view || !panel.open) return; // the panel has moved on
  status('');
  watchResult(result, title, from);
}

// ---- The chart: generations completed over the run's time ----

const SVG = 'http://www.w3.org/2000/svg';

function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A line chart of the generations completed over the run's seconds, drawn at the width it is
 * given on the page, with axes, their titles, a value at the line's end, and a crosshair that
 * reads out the nearest point on hover. With `table`, a table of the same points follows it.
 * @returns {{node: HTMLElement, update: (points: [number, number][]) => void}}
 */
function createChart(seconds, { table = false } = {}) {
  const svg = svgNode('svg', { class: 'contests-chart-svg', role: 'img', 'aria-label': 'Generations completed over the run' });
  const readout = h('div', { className: 'contests-chart-readout', attrs: { 'aria-hidden': 'true' } });
  readout.hidden = true;
  const tableBox = table ? h('details', { className: 'contests-chart-table' }, h('summary', { text: 'Show the data as a table' })) : null;
  const node = h('figure', { className: 'contests-chart' },
    h('figcaption', { className: 'contests-chart-caption' },
      h('span', { className: 'contests-chart-title', text: 'Generations completed' }),
      h('span', { className: 'contests-chart-subtitle', text: `over the ${seconds} seconds: the steeper the line, the faster the machine` })),
    h('div', { className: 'contests-chart-plot' }, svg, readout),
    tableBox);
  let layout = null;
  let latest = [];

  function draw() {
    const width = Math.max(280, Math.round(svg.parentElement?.clientWidth || 520));
    drawnWidth = Math.round(node.clientWidth);
    const height = Math.round(Math.min(260, Math.max(200, width * 0.42)));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    layout = chartLayout(latest, { seconds, width, height });
    const { plot } = layout;
    const parts = [];
    for (const tick of layout.yTicks) {
      parts.push(svgNode('line', { class: 'contests-chart-grid', x1: plot.left, x2: plot.right, y1: tick.at, y2: tick.at }));
      parts.push(svgNode('text', { class: 'contests-chart-tick', x: plot.left - 8, y: tick.at, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, tick.label));
    }
    for (const tick of layout.xTicks) {
      parts.push(svgNode('text', { class: 'contests-chart-tick', x: tick.at, y: plot.bottom + 16, 'text-anchor': 'middle' }, tick.label));
    }
    parts.push(svgNode('line', { class: 'contests-chart-axis', x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.bottom }));
    parts.push(svgNode('text', { class: 'contests-chart-axis-title', x: (plot.left + plot.right) / 2, y: height - 4, 'text-anchor': 'middle' }, 'Time (seconds)'));
    parts.push(svgNode('text', {
      class: 'contests-chart-axis-title', x: 0, y: 0, 'text-anchor': 'middle',
      transform: `translate(14 ${(plot.top + plot.bottom) / 2}) rotate(-90)`,
    }, 'Generations'));
    if (layout.end) {
      parts.push(svgNode('path', { class: 'contests-chart-area', d: layout.area }));
      parts.push(svgNode('polyline', { class: 'contests-chart-line', points: layout.line }));
      parts.push(svgNode('circle', { class: 'contests-chart-dot', cx: layout.end.x, cy: layout.end.y, r: 4 }));
      parts.push(svgNode('text', { class: 'contests-chart-end', x: layout.end.x + 8, y: layout.end.y, 'dominant-baseline': 'middle' }, layout.end.label));
    }
    parts.push(svgNode('line', { class: 'contests-chart-crosshair', y1: plot.top, y2: plot.bottom, x1: 0, x2: 0, visibility: 'hidden' }));
    parts.push(svgNode('circle', { class: 'contests-chart-dot contests-chart-hover', r: 4, cx: 0, cy: 0, visibility: 'hidden' }));
    svg.replaceChildren(...parts);
  }

  function hover(event) {
    if (!layout?.end) return;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
    const point = layout.nearest(px);
    if (!point) return;
    const [line, dot] = [svg.querySelector('.contests-chart-crosshair'), svg.querySelector('.contests-chart-hover')];
    line.setAttribute('x1', point.x);
    line.setAttribute('x2', point.x);
    line.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
    dot.setAttribute('visibility', 'visible');
    readout.textContent = `${point.seconds.toFixed(2)} s · ${n(point.generation)} generations`;
    readout.hidden = false;
    const scale = box.width / svg.viewBox.baseVal.width;
    readout.style.left = `${Math.min(point.x * scale + 10, box.width - readout.offsetWidth - 4)}px`;
    readout.style.top = `${Math.max(0, point.y * scale - 34)}px`;
  }
  function unhover() {
    svg.querySelector('.contests-chart-crosshair')?.setAttribute('visibility', 'hidden');
    svg.querySelector('.contests-chart-hover')?.setAttribute('visibility', 'hidden');
    readout.hidden = true;
  }
  svg.addEventListener('pointermove', hover);
  svg.addEventListener('pointerleave', unhover);
  // Redrawn at the new width when the panel's changes (a window resized, a phone turned)
  let drawnWidth = 0;
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width && width !== drawnWidth && layout) draw();
    }).observe(node);
  }

  return {
    node,
    update(points) {
      latest = points.slice();
      draw();
      if (tableBox) {
        tableBox.querySelector('table')?.remove();
        const rows = latest.map(([t, g]) => h('tr', {}, h('td', { text: t.toFixed(2) }), h('td', { text: n(g) })));
        tableBox.append(h('table', {},
          h('thead', {}, h('tr', {}, h('th', { text: 'Time (s)' }), h('th', { text: 'Generations' }))),
          h('tbody', {}, ...rows)));
      }
    },
  };
}

/** The statistics as a grid of small figures: secondary to the countdown and the score. */
function statsGrid(rows, idPrefix) {
  return h('div', { className: 'contests-stats' }, ...rows.map(([label, value], i) => h('div', { className: 'contests-stat' },
    h('span', { className: 'contests-stat-label', text: label }),
    h('span', { className: 'contests-stat-value', text: value, attrs: idPrefix ? { id: `${idPrefix}-${i}` } : {} }))));
}

// ---- The run ----

function startRun(contest) {
  endRun();
  const chart = createChart(contest.seconds);
  const run = new SpeedRun(contest, {
    onStart: () => {
      if (panel.run !== run) return;
      panel.startedAt = performance.now();
      hud(undefined, 'Running');
    },
    onStats: (stats) => panel.run === run && showStats(stats, chart),
    onEnd: (end) => panel.run === run && showResults(run, end),
    onError: (message) => panel.run === run && status(`The engine says: ${message}`),
  });
  panel.run = run;
  // The ring is a clock: its arc empties over the contest's seconds, on the page's clock
  const ring = svgNode('svg', { class: 'contests-clock-ring', viewBox: '0 0 160 160', 'aria-hidden': 'true' });
  ring.append(
    svgNode('circle', { class: 'contests-clock-track', cx: 80, cy: 80, r: 72 }),
    svgNode('circle', { class: 'contests-clock-arc', cx: 80, cy: 80, r: 72, pathLength: 100, id: 'contests-clock-arc' }));
  show('running', `${contest.title}: running`, [
    h('div', { className: 'contests-run-top' },
      h('div', { className: 'contests-clock' },
        ring,
        h('div', { className: 'contests-clock-face' },
          h('span', { className: 'contests-countdown-value', text: countdownText(contest.seconds, 0), attrs: { id: 'contests-countdown' } }),
          h('span', { className: 'contests-clock-unit', text: 'seconds left' }))),
      statsGrid(statsRows(emptyStats()), 'contests-stat')),
    chart.node,
    h('div', { className: 'contests-actions' }, button('Stop', () => run.stop(), { id: 'contests-stop' })),
  ]);
  chart.update(run.points);
  hud(contest.title, 'Starting', '0');
  run.start();
}

function emptyStats() {
  return { generation: 0, rate: 0, live: 0, livePeak: 0, chunks: 0, memoryBytes: 0, extent: null };
}

function showStats(stats, chart) {
  statsRows(stats).forEach(([, value], i) => {
    const cell = el(`contests-stat-${i}`);
    if (cell) cell.textContent = value;
  });
  chart.update(panel.run.points);
  hud(undefined, undefined, n(stats.generation));
}

// ---- The results card ----

async function showResults(run, { stats, reason, score }) {
  const { contest } = run;
  panel.startedAt = 0;
  hud(contest.title, score ? 'Finished' : 'Stopped', n(stats.generation));
  const again = button('Run again', () => showContest(contest), { main: !score, id: 'contests-again' });
  const back = button('Back to the contest', showList, { id: 'contests-back' });
  const chart = createChart(contest.seconds, { table: true });
  if (!score) {
    run.close();
    show('results', `${contest.title}: no score`, [
      h('p', { text: speedEndingText(reason, contest) }),
      chart.node,
      statsGrid(statsRows(stats)),
      h('div', { className: 'contests-actions' }, again, back),
    ]);
    chart.update(run.points);
    return;
  }

  const exportButton = button('Export result', null, { main: true, id: 'contests-export' });
  exportButton.disabled = true;
  const watchButton = button('Watch', null, { id: 'contests-watch-run' });
  watchButton.disabled = true;
  const verified = h('p', {
    className: 'contests-self-verified',
    text: `Watch plays the run back in 3D, replayed from its seed, and checks the replay's hash at generation ${n(stats.generation)} against this one.`,
    attrs: { id: 'contests-self-verified', 'data-verdict': 'pending' },
  });
  const hero = speedHero(score, contest);
  const meta = h('span', { className: 'contests-hero-meta', text: 'Detecting the browser…', attrs: { id: 'contests-hero-meta' } });
  const hash = h('span', { className: 'contests-hash', text: `Hashing generation ${n(stats.generation)}…`, attrs: { id: 'contests-hash' } });
  const copy = button('Copy', null, { id: 'contests-copy-hash' });
  copy.disabled = true;
  const submitBox = h('section', { className: 'contests-section contests-submit', attrs: { id: 'contests-submit', 'aria-labelledby': 'contests-submit-title' } },
    h('h3', { className: 'contests-section-title', text: 'Enter it', attrs: { id: 'contests-submit-title' } }),
    h('p', { className: 'contests-note', text: 'Submit by email is ready once the result file is made.' }));
  show('results', `${contest.title}: your result`, [
    h('div', { className: 'contests-hero', attrs: { role: 'group', 'aria-label': `Your score: ${speedScoreText(score)}` } },
      h('span', { className: 'contests-hero-kicker' }, logo(contest.kind, 22, 'contests-hero-logo'), document.createTextNode(`${contest.title} · your score`)),
      h('span', { className: 'contests-hero-value', text: hero.value, attrs: { id: 'contests-score' } }),
      h('span', { className: 'contests-hero-unit', text: hero.unit, attrs: { id: 'contests-score-unit' } }),
      meta),
    chart.node,
    h('p', { className: 'contests-ending', text: speedEndingText(reason, contest) }),
    statsGrid(statsRows(stats)),
    h('div', { className: 'contests-hash-box' },
      h('span', { className: 'contests-hash-label', text: "The result's hash" }),
      h('div', { className: 'contests-hash-row' }, hash, copy)),
    verified,
    h('p', { className: 'contests-note', text: SELF_REPORTED }),
    h('div', { className: 'contests-actions' }, exportButton, watchButton, again, back),
    submitBox,
  ]);
  chart.update(run.points);

  let made;
  try {
    const detected = await detectBrowser();
    if (panel.run !== run) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    meta.textContent = `${detected ? `${detected.name} ${detected.version}` : 'Browser not detected'} · ${date}`;
    made = await run.makeResult(detected);
  } catch (err) {
    if (panel.run === run) status(`The result file couldn't be made: ${err.message}`);
    return;
  } finally {
    // The result is made: the run's Worker, and its memory, can go
    if (panel.run === run) run.close();
  }
  if (panel.run !== run) return;
  hash.textContent = made.result.hash;
  copy.disabled = false;
  copy.onclick = () => copyText(made.result.hash, 'hash');
  submitBox.replaceChildren(submitBox.firstChild, ...submitParts({
    contest, score, browser: made.result.details.browser, hash: made.result.hash, text: made.text,
  }));
  exportButton.disabled = false;
  exportButton.onclick = () => exportResult(contest, score, made.text);
  watchButton.disabled = false;
  watchButton.onclick = () => watchResult(made.result, `${contest.title}: ${speedScoreText(score)}`, watchButton, verified);
  // Export is what comes next, unless the visitor has moved on to another button meanwhile
  if (!el('contests-panel').contains(document.activeElement) || document.activeElement === again) {
    exportButton.focus({ preventScroll: true });
  }
}

async function exportResult(contest, score, text) {
  try {
    status(await writeJsonFile(resultFileName(contest, score), text, `Contest result, ${contest.title}`));
  } catch (err) {
    if (err?.name === 'AbortError') return; // the visitor cancelled the save dialog
    status(`Not saved: ${err.message}`);
  }
}

/** Copies text to the clipboard; `what` names it, should the browser refuse. */
async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    status('Copied.');
  } catch {
    status(`The browser didn't allow copying; select the ${what} and copy it by hand.`);
  }
}

// ---- Submit by email ----

/**
 * The results card's Submit by email: the link that downloads the result file and opens the
 * email, what must be attached by hand, and the address, subject and text with Copy, for webmail.
 * The link is a plain mailto: link, so the browser opens the mail app as it would for any other;
 * clicking it downloads the file first, in the same click.
 */
function submitParts({ contest, score, browser, hash, text }) {
  const fileName = resultFileName(contest, score);
  const subject = emailSubject(contest, score);
  const body = emailBody({ contest, score, browser, hash, fileName });
  const link = h('a', {
    className: 'glass-button contests-button contests-submit-button',
    text: 'Submit by email',
    attrs: { href: mailtoLink(subject, body), id: 'contests-submit-email' },
  });
  link.onclick = () => {
    download(fileName, text);
    status(`Downloaded ${fileName}. Attach it to the email, and a picture if you like.`);
  };
  const copyRow = (label, value, id, what) => h('div', { className: 'contests-submit-row' },
    h('span', { className: 'contests-submit-label', text: label }),
    h('span', { className: 'contests-submit-value', text: value, attrs: { id } }),
    button('Copy', () => copyText(value, what), { id: `${id}-copy` }));
  const textBox = h('textarea', {
    className: 'contests-submit-text',
    attrs: { id: 'contests-submit-body', readonly: '', rows: '8', spellcheck: 'false', 'aria-label': 'The email\'s text' },
  });
  textBox.value = body;
  return [
    h('p', { text: `Submit by email downloads your result file, ${fileName}, and opens an email to ${SUBMIT_ADDRESS} with its text filled in: add the name to show, and keep or delete the Hall of Fame line.` }),
    h('div', { className: 'contests-submit-go' },
      link,
      h('p', { className: 'contests-submit-attach', text: `An email link can't attach files: attach ${fileName}, and a picture if you like, by hand.`, attrs: { id: 'contests-submit-attach' } })),
    h('p', { className: 'contests-note', text: 'No mail app? Send it from webmail, with these:' }),
    h('div', { className: 'contests-submit-copy' },
      copyRow('To', SUBMIT_ADDRESS, 'contests-submit-to', 'address'),
      copyRow('Subject', subject, 'contests-submit-subject', 'subject'),
      h('div', { className: 'contests-submit-row contests-submit-row--text' },
        h('span', { className: 'contests-submit-label', text: 'Text' }),
        textBox,
        button('Copy', () => copyText(body, 'text'), { id: 'contests-submit-body-copy' }))),
  ];
}

// ---- Watch ----

/**
 * Plays a result back in 3D (watch.js), and comes back to the button that opened it. What the
 * replay finds goes on the card's line too, if it has one.
 */
function watchResult(result, title, from, line = null) {
  const view = panel.view;
  hud(undefined, 'Watching');
  openWatch(result, {
    title,
    onReplayed: (found) => {
      if (!line) return;
      line.textContent = found.text;
      line.dataset.verdict = found.verdict;
    },
    onClose: () => {
      if (panel.view !== view) return;
      hud(undefined, { results: 'Finished', contest: 'Ready' }[view] ?? 'Checked');
      from.focus({ preventScroll: true });
    },
  });
}

// ---- Verify a result ----

function chooseFile() {
  el('contests-verify-file').click();
}

async function verifyFile(file) {
  endRun();
  cancelVerify();
  const back = panel.contest;
  if (file.size > MAX_RESULT_BYTES) {
    showVerdict(file.name, { verdict: 'refused', message: `The file is larger than ${MAX_RESULT_BYTES / 1024 / 1024} MB, so it isn't a result file. It wasn't read.` }, back);
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch (err) {
    showVerdict(file.name, { verdict: 'error', message: `The file couldn't be read: ${err.message}` }, back);
    return;
  }
  const check = verifyInWorker(text);
  panel.verify = check;
  hud(undefined, 'Verifying');
  show('verifying', 'Verify a result', [
    h('p', { text: `Checking ${file.name}: replaying its run from the seed, in a background thread. A long run takes a while.` }),
    h('div', { className: 'contests-actions' }, button('Cancel', () => check.cancel(), { id: 'contests-cancel' })),
  ]);
  const answer = await check.promise;
  if (panel.verify !== check) return; // the panel has moved on
  panel.verify = null;
  showVerdict(file.name, answer, back, text);
}

/**
 * The verdict on a file, with Watch for any file that could be read: a mismatch can be watched
 * too, to see where it goes.
 * @param {string} [text] - the file's contents, for Watch
 */
function showVerdict(name, answer, back, text) {
  hud(undefined, answer.verdict === 'verified' ? 'Verified' : 'Checked');
  const rows = [['File', name]];
  if (answer.contest !== undefined) rows.push(['Branch', answer.contest ?? 'none']);
  if (answer.generation !== null && answer.generation !== undefined) rows.push(['Generation', n(answer.generation)]);
  if (answer.ending) rows.push(['Ended', answer.ending]);
  if (answer.score) {
    rows.push(['Score', 'generations' in answer.score && 'ms' in answer.score
      ? `${speedScoreText(answer.score)} (the time is self-reported)`
      : JSON.stringify(answer.score)]);
  }
  // Watch reads the file again, on this thread: readResult() checks it as untrusted data
  const readable = text !== undefined && ['verified', 'mismatch', 'not-checked'].includes(answer.verdict);
  const line = readable ? h('p', {
    className: 'contests-self-verified',
    text: 'Watch plays the run back in 3D, replayed from its seed, and checks the replay\'s hash at the file\'s generation.',
    attrs: { id: 'contests-self-verified', 'data-verdict': 'pending' },
  }) : null;
  let watchButton = null;
  if (readable) {
    watchButton = button('Watch', () => {
      let result;
      try {
        result = readResult(text);
      } catch (err) {
        status(err instanceof ResultError ? `It can't be watched: ${err.message}` : `It can't be watched: ${err?.message ?? err}`);
        return;
      }
      watchResult(result, `Watch: ${name}`, watchButton, line);
    }, { id: 'contests-watch-run' });
  }
  show('verdict', 'Verify a result', [
    h('div', { className: 'contests-verdict-head' },
      verifyGlyph(30),
      h('p', { className: `contests-verdict contests-verdict--${answer.verdict}`, text: verdictTitle(answer.verdict), attrs: { id: 'contests-verdict' } })),
    h('p', { text: answer.message, attrs: { id: 'contests-verdict-message' } }),
    facts(rows),
    line,
    h('div', { className: 'contests-actions' },
      watchButton,
      verifyButton('Verify another'),
      back ? button(`Back to ${back.title}`, () => showContest(back), { id: 'contests-back' }) : null,
      button('Back to the contest', showList, { id: 'contests-list' })),
  ]);
}

