#!/usr/bin/env node
// test-guard.mjs -- deterministic test for the empty-body extraction guard.
//
// Proves the guard that prevents the silent-truncation data-loss regression:
// assertNonEmptyExtraction MUST throw on an empty / near-empty body and MUST NOT
// throw on real content. Run with `npm test`. No LLM, no network, no fixtures.
//
// Power-of-10 in spirit: a small fixed table of cases, a bounded loop, an
// asserted invariant, non-zero exit on any failure.

import { assertNonEmptyExtraction, MIN_EXTRACT_CHARS } from './lib/nonempty.mjs'

let failures = 0

function expectThrows(label, kind, rel, text) {
  let threw = false
  try {
    assertNonEmptyExtraction(kind, rel, text)
  } catch {
    threw = true
  }
  if (!threw) {
    failures += 1
    process.stderr.write(`FAIL: expected throw for ${label}\n`)
  } else {
    process.stdout.write(`ok: throws for ${label}\n`)
  }
}

function expectPasses(label, kind, rel, text) {
  let threw = false
  try {
    assertNonEmptyExtraction(kind, rel, text)
  } catch (e) {
    threw = true
    process.stderr.write(`FAIL: unexpected throw for ${label}: ${String((e && e.message) || e)}\n`)
  }
  if (!threw) {
    process.stdout.write(`ok: passes for ${label}\n`)
  } else {
    failures += 1
  }
}

// A below-floor string: fewer than MIN_EXTRACT_CHARS non-whitespace chars.
const belowFloor = 'x'.repeat(Math.max(0, MIN_EXTRACT_CHARS - 1))
// Whitespace-only body with more raw length than the floor but zero content.
const whitespaceOnly = ' \n\t'.repeat(MIN_EXTRACT_CHARS + 5)

// Empty / near-empty bodies MUST trip the guard.
expectThrows('empty string', 'document', 'a.docx', '')
expectThrows('whitespace only', 'document', 'b.pdf', whitespaceOnly)
expectThrows('below floor', 'spreadsheet', 'c.xlsx', belowFloor)
expectThrows('non-string body', 'document', 'd.docx', null)

// Real content MUST pass.
expectPasses(
  'full document body',
  'document',
  'scribl-d2c-mlp-prfaq.docx',
  'Scribl D2C MLP PRFAQ\n\nPRESS RELEASE\n\nScribl launches the daily creative practice.'
)
expectPasses(
  'rendered table body',
  'spreadsheet',
  'scribl-d2c-aws-estimate-v3.xlsx',
  '## README\n\n| Scribl D2C Infrastructure TCO Model |\n| --- |\n| A 30-month run-rate model. |'
)

if (failures > 0) {
  process.stderr.write(`\ntest-guard: ${failures} assertion(s) failed\n`)
  process.exit(1)
}
process.stdout.write('\ntest-guard: all assertions passed\n')
process.exit(0)
