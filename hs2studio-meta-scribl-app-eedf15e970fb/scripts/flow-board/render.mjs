#!/usr/bin/env node
// render.mjs -- render flow-board.html to the committed "Live app flow" PNG.
//
// Uses headless Chrome (system install; no npm browser download). Writes the
// PNG to both committed locations. Deterministic: fixed 5400x2120 viewport,
// device-scale-factor 1, no network.
//
// Power-of-10 in spirit: bounded candidate lists, every exit code / file
// checked, invariants asserted, fails loud with a non-zero exit.

import { existsSync, statSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

const HTML = join(HERE, 'flow-board.html')
const WIDTH = 5400
const HEIGHT = 2120

const OUTPUTS = [
  join(REPO, 'docs/public/assets/context/scribl-live-app-flow-2026-07-20.png'),
  join(REPO, 's2d/inputs/scribl-live-app-flow-2026-07-20.png'),
]

// Bounded, ordered list of Chrome/Chromium candidates.
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

function die(msg) {
  process.stderr.write(`render: ${msg}\n`)
  process.exit(1)
}

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (existsSync(c)) return c
  }
  die(
    'no Chrome/Chromium found. Install Google Chrome or set CHROME_BIN. ' +
      `Looked at: ${CHROME_CANDIDATES.join(', ')}`
  )
}

function main() {
  if (!existsSync(HTML)) die(`missing template: ${HTML}`)
  const chrome = findChrome()

  const workdir = mkdtempSync(join(tmpdir(), 'flow-board-'))
  const shot = join(workdir, 'board.png')
  const url = pathToFileURL(HTML).href

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${shot}`,
    '--virtual-time-budget=4000', // let images decode + layout settle
    url,
  ]

  const r = spawnSync(chrome, args, { stdio: 'inherit' })
  if (r.error) die(`failed to launch Chrome: ${r.error.message}`)
  if (r.status !== 0) die(`Chrome exited with status ${r.status}`)
  if (!existsSync(shot)) die('Chrome produced no screenshot')

  const bytes = statSync(shot).size
  if (bytes < 10_000) die(`screenshot suspiciously small (${bytes} bytes)`)

  let wrote = 0
  for (const out of OUTPUTS) {
    if (!existsSync(dirname(out))) die(`output dir missing: ${dirname(out)}`)
    copyFileSync(shot, out)
    wrote += 1
    process.stdout.write(`wrote ${out} (${bytes} bytes)\n`)
  }
  if (wrote !== OUTPUTS.length) die('did not write all outputs')

  rmSync(workdir, { recursive: true, force: true })
  process.stdout.write(`render: done -- ${WIDTH}x${HEIGHT}, ${wrote} file(s)\n`)
}

main()
