#!/usr/bin/env node
// test-normalize-prose.mjs -- deterministic tests for the shared prose
// normalizer (scripts/lib/normalize-prose.mjs).
//
// Guards the em-dash rule against the doubled-space regression: a source that
// already spaces its em-dashes ("X \u2014 Y") must normalize to a single-spaced
// "X -- Y", never "X  --  Y". Also proves newlines survive em-dashes at line
// boundaries and that normalization is idempotent. Run with `npm test`.
//
// Power-of-10 in spirit: a small fixed table of cases, a bounded loop, an
// asserted invariant, non-zero exit on any failure.

import { normalizeProse } from './lib/normalize-prose.mjs'

let failures = 0

// Render control characters visibly in failure messages.
function show(s) {
  return JSON.stringify(s)
}

function expectEquals(label, input, expected) {
  const got = normalizeProse(input)
  if (got !== expected) {
    failures += 1
    process.stderr.write(`FAIL: ${label}: expected ${show(expected)}, got ${show(got)}\n`)
  } else {
    process.stdout.write(`ok: ${label}\n`)
  }
}

function expectIdempotent(label, input) {
  const once = normalizeProse(input)
  const twice = normalizeProse(once)
  if (once !== twice) {
    failures += 1
    process.stderr.write(`FAIL: idempotency for ${label}: ${show(once)} != ${show(twice)}\n`)
  } else {
    process.stdout.write(`ok: idempotent for ${label}\n`)
  }
}

// Fixed case table: [label, input, expected]. Bounded, no I/O. This source is
// pure ASCII (repo prose rules): forbidden glyphs are written as \u escapes.
const CASES = [
  ['bare em-dash', 'X\u2014Y', 'X -- Y'],
  ['pre-spaced em-dash', 'X \u2014 Y', 'X -- Y'],
  ['multi-spaced em-dash', 'X  \u2014  Y', 'X -- Y'],
  ['em-dash at line end keeps the newline', 'X\u2014\nY', 'X -- \nY'],
  ['em-dash at line start keeps the newline', 'A\n\u2014B', 'A\n -- B'],
  ['em-dash at string start', '\u2014Y', ' -- Y'],
  ['already-doubled ASCII collapses', 'X  --  Y', 'X -- Y'],
  ['single-spaced ASCII unchanged', 'X -- Y', 'X -- Y'],
  ['markdown table separator unchanged', '| --- |\n| a |', '| --- |\n| a |'],
  ['shell double-dash separator unchanged', 'git checkout -- .', 'git checkout -- .'],
  ['double-dash flag unchanged', 'run with --verbose', 'run with --verbose'],
  ['bare arrow', 'A\u2192B', 'A->B'],
  ['pre-spaced arrow stays single-spaced', 'A \u2192 B', 'A -> B'],
  ['en-dash range', '3\u20135', '3-5']
]

for (let i = 0; i < CASES.length; i += 1) {
  const [label, input, expected] = CASES[i]
  expectEquals(label, input, expected)
  expectIdempotent(label, input)
}

if (failures > 0) {
  process.stderr.write(`\ntest-normalize-prose: ${failures} assertion(s) failed\n`)
  process.exit(1)
}
process.stdout.write('\ntest-normalize-prose: all assertions passed\n')
process.exit(0)
