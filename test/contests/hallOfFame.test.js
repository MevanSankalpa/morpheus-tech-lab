// SPDX-License-Identifier: Apache-2.0
//
// The Hall of Fame (#79): the data file checked against its result files, as `npm test` does on
// every change, and reading, ranking and checking entries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../../src/unbounded/world.js';
import { step } from '../../src/unbounded/step.js';
import { resultOf, resultText, worldOptions } from '../../src/unbounded/canonical.js';
import { contestById, runFor, speedScore } from '../../src/unbounded/contests.js';
import {
  HallOfFameError, readHallOfFame, rankEntries, checkEntry, dayText, HALL_OF_FAME_TOP,
} from '../../src/contests/hallOfFame.js';

const SPEED = contestById('speed-1');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, 'src/unbounded/hall-of-fame.json');

test('the Hall of Fame: every entry reads, and agrees with its result file', () => {
  const entries = readHallOfFame(JSON.parse(readFileSync(DATA, 'utf8')));
  for (const entry of entries) {
    const file = join(PUBLIC, entry.result);
    assert.ok(existsSync(file), `${entry.result} is missing`);
    assert.equal(checkEntry(entry, readFileSync(file, 'utf8')), null, entry.result);
    if (entry.picture) {
      const picture = join(PUBLIC, entry.picture);
      assert.ok(existsSync(picture), `${entry.picture} is missing`);
      assert.ok(statSync(picture).size <= 1024 * 1024, `${entry.picture} is over 1 MB`);
    }
  }
  // Every file in the board's folders belongs to an entry: nothing is left behind by a removal
  const listed = new Set(entries.flatMap((e) => [e.result, e.picture]).filter(Boolean));
  for (const dir of ['hall-of-fame', 'hall-of-fame/results']) {
    if (!existsSync(join(PUBLIC, dir))) continue;
    for (const name of readdirSync(join(PUBLIC, dir), { withFileTypes: true })) {
      if (name.isFile()) assert.ok(listed.has(`${dir}/${name.name}`), `public/${dir}/${name.name} isn't an entry's`);
    }
  }
});

// ---- A Speed result to check entries against ----

const GENS = 3;

async function speedResult({ generations = GENS, browser = { name: 'Firefox', version: '155.0' } } = {}) {
  const run = runFor(SPEED);
  const world = new World(worldOptions(run, { chunkSize: SPEED.chunkSize }));
  world.setCells(run.seed);
  while (world.generation < generations) assert.equal(step(world), null);
  const result = await resultOf(world, {
    run, ending: 'deadline', score: speedScore(SPEED, world.generation, 6000.2),
    details: { elapsedMs: 6000.2, browser },
  });
  return resultText(result);
}

const entry = (over = {}) => ({
  contest: 'speed-1',
  name: 'Ada',
  picture: null,
  score: { generations: GENS, ms: null },
  browser: { name: 'Firefox', version: '155.0' },
  date: '2026-11-20',
  result: 'hall-of-fame/results/speed-1-ada.json',
  ...over,
});

test('checkEntry: an entry agrees with its result file, or says what differs', async () => {
  const text = await speedResult();
  assert.equal(checkEntry(entry(), text), null);
  assert.match(checkEntry(entry({ score: { generations: GENS + 1, ms: null } }), text), /score isn't its result file's/);
  assert.match(checkEntry(entry({ browser: { name: 'Chrome', version: '142.0' } }), text), /browser isn't its result file's/);
  assert.match(checkEntry(entry({ browser: null }), text), /browser isn't its result file's/);
  // A file that isn't a result, or doesn't pass its contest
  assert.match(checkEntry(entry(), '{"format": "nope"}'), /isn't a result file/);
  const data = JSON.parse(text);
  data.score.generations = GENS + 1;
  assert.match(checkEntry(entry(), JSON.stringify(data)), /The score says 4 generations, but the file is generation 3/);
  data.score.generations = GENS;
  data.run.contest = null;
  delete data.score;
  assert.match(checkEntry(entry(), JSON.stringify(data)), /a result for no contest, not speed-1/);
});

test('readHallOfFame: the shape of the file and of each entry', () => {
  assert.deepEqual(readHallOfFame({ entries: [] }), []);
  assert.deepEqual(readHallOfFame({ entries: [entry()] }), [entry()]);
  const bad = [
    [[], /must be \{"entries"/],
    [{ entries: [], more: 1 }, /must be \{"entries"/],
    [{ entries: [entry({ contest: 'speed-2' })] }, /contest must be one of this lab's contests/],
    [{ entries: [entry({ name: '' })] }, /name must be text of 1 to 40/],
    [{ entries: [entry({ name: ' Ada' })] }, /name must be text/],
    [{ entries: [entry({ name: 'x'.repeat(41) })] }, /name must be text/],
    [{ entries: [entry({ name: 'A\nB' })] }, /name must be text/],
    [{ entries: [entry({ picture: '../secret.png' })] }, /picture must be null or a \.png or \.jpg/],
    [{ entries: [entry({ picture: 'hall-of-fame/ada.gif' })] }, /picture must be null/],
    [{ entries: [entry({ picture: 'hall-of-fame/sub/ada.png' })] }, /picture must be null/],
    [{ entries: [entry({ score: 412 })] }, /score must be an object/],
    [{ entries: [entry({ score: { generations: 1.5, ms: null } })] }, /score must be an object of whole numbers/],
    [{ entries: [entry({ browser: { name: 'Firefox' } })] }, /browser must be null or \{name, version\}/],
    [{ entries: [entry({ date: '2026-02-30' })] }, /date must be the day/],
    [{ entries: [entry({ date: '20 Nov 2026' })] }, /date must be the day/],
    [{ entries: [entry({ result: 'hall-of-fame/results/../../x.json' })] }, /result must be a \.json under hall-of-fame\/results\//],
    [{ entries: [entry({ result: 'https://example.com/x.json' })] }, /result must be a \.json/],
    [{ entries: [entry({ extra: 1 })] }, /unknown field, "extra"/],
    [{ entries: [(({ date, ...rest }) => rest)(entry())] }, /has no date/],
    [{ entries: [entry(), entry({ name: 'Bo' })] }, /entries\[1\]\.result is another entry's too/],
  ];
  for (const [data, message] of bad) {
    assert.throws(() => readHallOfFame(data), (err) => err instanceof HallOfFameError && message.test(err.message), String(message));
  }
});

test('rankEntries: as Speed ranks, then the earlier date, then the order they arrived in', () => {
  const at = (name, generations, ms, date) => entry({ name, score: { generations, ms }, date, result: `hall-of-fame/results/${name}.json` });
  const entries = [
    at('slow', 412, null, '2026-11-20'),
    at('ceiling-late', 1000, 4210, '2026-11-22'),
    at('ceiling-fast', 1000, 3900, '2026-11-25'),
    at('tie-arrived-first', 900, null, '2026-11-21'),
    at('tie-arrived-second', 900, null, '2026-11-21'),
    at('tie-earlier', 900, null, '2026-11-20'),
  ];
  assert.deepEqual(rankEntries(entries, SPEED).map((e) => e.name),
    ['ceiling-fast', 'ceiling-late', 'tie-earlier', 'tie-arrived-first', 'tie-arrived-second', 'slow']);
  // Only the contest's own entries
  assert.deepEqual(rankEntries(entries, { id: 'methuselah-1', kind: 'methuselah' }), []);
  assert.ok(HALL_OF_FAME_TOP >= 3);
});

test('dayText: the date as the board shows it', () => {
  assert.equal(dayText('2026-11-20'), '20 Nov 2026');
  assert.equal(dayText('2027-01-01'), '1 Jan 2027');
});
