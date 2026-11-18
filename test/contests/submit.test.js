// SPDX-License-Identifier: Apache-2.0
//
// Submitting a result by email (#79): the subject, the filled-in text and what it promises, and
// the mailto: link.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contestById } from '../../src/unbounded/contests.js';
import {
  SUBMIT_ADDRESS, HALL_OF_FAME_LINE, emailSubject, emailBody, mailtoLink,
} from '../../src/contests/submit.js';

const SPEED = contestById('speed-1');
const HASH = 'a'.repeat(64);
const entry = (over = {}) => ({
  contest: SPEED,
  score: { generations: 412, ms: null },
  browser: { name: 'Chrome', version: '142.0.7444.59' },
  hash: HASH,
  fileName: 'speed-1-412.json',
  ...over,
});

test('the subject names the contest and the score', () => {
  assert.equal(emailSubject(SPEED, { generations: 412, ms: null }), '[Speed] 412 generations');
  assert.equal(emailSubject(SPEED, { generations: 1000, ms: 4210 }), '[Speed] 1,000 generations in 4.210 s');
  assert.equal(emailSubject(SPEED, { generations: 1000, ms: 3871 }), '[Speed] 1,000 generations in 3.871 s');
});

test('the text is the template, filled in: the result, the browser, and fields to finish', () => {
  const lines = emailBody(entry()).split('\n');
  assert.ok(lines.includes('My entry for Speed (speed-1).'));
  assert.ok(lines.includes('Score: 412 generations'));
  assert.ok(lines.includes('Result file: speed-1-412.json (attached)'));
  assert.ok(lines.includes(`Hash: ${HASH}`));
  assert.ok(lines.includes('Name to show: '));
  assert.ok(lines.includes('Browser and version: Chrome 142.0.7444.59'));
  assert.ok(lines.includes('Hardware (optional): '));
  // The Hall of Fame line stands alone, so deleting it is deleting one line
  assert.ok(lines.includes(HALL_OF_FAME_LINE));
  assert.match(lines[lines.indexOf(HALL_OF_FAME_LINE) - 1], /Keep the next line .* or delete it to opt out/);
  // A browser that wasn't detected is left for the entrant to fill in
  assert.ok(emailBody(entry({ browser: null })).split('\n').includes('Browser and version: '));
});

test('the text states the picture conditions, that the repo is public, how the address is used, and that Speed is self-reported', () => {
  const body = emailBody(entry());
  // The picture's conditions
  assert.match(body, /Picture \(optional\): attach a PNG or JPEG, square, at most 1 MB\./);
  assert.match(body, /must be yours to use, show no other people, and break nothing in the code of conduct/);
  assert.match(body, /resizes it to 128 x 128 and strips its metadata/);
  assert.match(body, /may decline a picture or a name/);
  // The repo is public, and what removal can and can't do
  assert.match(body, /The lab's repo is public: once committed, your name and picture are in its history and in every copy of it\./);
  assert.match(body, /Removal on request .* can't erase every copy\./);
  // The email address
  assert.match(body, /Your email address is used only to reply about this entry\. It is never published, committed or put in a result file\./);
  // Speed's timing
  assert.match(body, /Speed's timing is self-reported: a replay proves the generation, not how long it took\./);
  assert.match(body, /screen recording of a run on lab\.morpheustech\.net/);
});

test('the mailto: link opens the email, addressed, with the subject and text', () => {
  const subject = emailSubject(SPEED, { generations: 1000, ms: 4210 });
  const body = emailBody(entry({ score: { generations: 1000, ms: 4210 }, fileName: 'speed-1-1000-4210ms.json' }));
  assert.ok(body.split('\n').includes('Score: 1,000 generations in 4.210 s (the ceiling, so the time ranks it)'));
  const link = mailtoLink(subject, body);
  assert.equal(SUBMIT_ADDRESS, 'lab@morpheustech.net');
  assert.ok(link.startsWith('mailto:lab@morpheustech.net?subject='));
  const url = new URL(link);
  assert.equal(url.pathname, 'lab@morpheustech.net');
  assert.equal(url.searchParams.get('subject'), subject);
  assert.equal(url.searchParams.get('body'), body);
  // Spaces as %20, never +, which some mail apps keep as a plus
  assert.ok(!link.includes('+'));
  // Short enough for the mail apps with the tightest limits on a link's length
  assert.ok(link.length <= 2000, `${link.length} characters`);
});
