#!/usr/bin/env node
// Pins Morpheus Tech brand files into the lab from a released brand tag, and
// checks the pinned copies against brand.lock.
//
//   node scripts/brand.mjs sync brand/v3.2.0   copy from ../morpheus at that tag
//   node scripts/brand.mjs sync brand/v3.2.0 --org <path to a morpheus clone>
//   node scripts/brand.mjs check               fail if a pinned file was edited
//
// The brand is changed in the org repo, released as a brand/vX.Y.Z tag, and
// re-synced here. Never edit a pinned file by hand. The files are read from
// the tag with `git show`, so uncommitted work in the org repo never leaks in.
//
// The lab pins only what a page uses. The design system's documents and the
// full-size logo stay in the org repo; see NOTICE for how the pinned files
// are licensed.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = path.join(root, 'brand.lock')

// Org-repo path at the tag -> where the lab keeps it.
const PINS = {
  'design/brand/tokens.css': 'src/brand/tokens.css',
  'design/brand/favicon.svg': 'public/favicon.svg',
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const fail = (msg) => {
  console.error(`brand: ${msg}`)
  process.exit(1)
}

function sync(tag, org) {
  if (!/^brand\/v\d+\.\d+\.\d+$/.test(tag ?? '')) fail('usage: brand.mjs sync brand/vX.Y.Z [--org <repo>]')
  const git = (...args) => execFileSync('git', ['-C', org, ...args], { maxBuffer: 16 << 20 })
  let commit
  try {
    commit = git('rev-parse', '--verify', '-q', `refs/tags/${tag}^{commit}`).toString().trim()
  } catch {
    fail(`no tag ${tag} in ${org}`)
  }
  // Read everything before writing anything, so a failure leaves the pin as it was.
  const files = Object.entries(PINS).map(([src, dest]) => {
    try {
      return [dest, git('show', `${commit}:${src}`)]
    } catch {
      fail(`${src} is not in ${tag}`)
    }
  })
  for (const [dest, bytes] of files) {
    mkdirSync(path.dirname(path.join(root, dest)), { recursive: true })
    writeFileSync(path.join(root, dest), bytes)
  }
  const lock = {
    tag,
    commit,
    files: Object.fromEntries(files.map(([dest, bytes]) => [dest, sha256(bytes)]).sort()),
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  console.log(`brand: pinned ${files.length} files at ${tag} (${commit.slice(0, 12)})`)
}

function check() {
  if (!existsSync(lockPath)) fail('brand.lock is missing; run: node scripts/brand.mjs sync brand/vX.Y.Z')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const problems = []
  for (const [dest, want] of Object.entries(lock.files)) {
    const file = path.join(root, dest)
    if (!existsSync(file)) problems.push(`${dest} is missing`)
    else if (sha256(readFileSync(file)) !== want) problems.push(`${dest} differs from ${lock.tag}; re-sync, never hand-edit`)
  }
  if (problems.length) fail(problems.join('\n       '))
  console.log(`brand: ${Object.keys(lock.files).length} pinned files match ${lock.tag}`)
}

const [cmd, tag, ...rest] = process.argv.slice(2)
if (cmd === 'sync') {
  let org = path.resolve(root, '..', 'morpheus')
  if (rest[0] === '--org' && rest[1]) org = path.resolve(rest[1])
  sync(tag, org)
} else if (cmd === 'check') {
  check()
} else {
  fail('usage: brand.mjs sync brand/vX.Y.Z [--org <repo>] | brand.mjs check')
}
