#!/usr/bin/env node
// context-ingest.mjs -- the shared ingestion core for the living wiki's
// "Context Information" section.
//
// It scans a project brain's input artifacts (s2d/inputs/, recursively) and its
// knowledge base (knowledge/), extracts their content, and emits derived
// markdown pages plus copied images into a brain SOURCE tree (s2d/context/ and
// docs/public/assets/context/). scripts/docs-sync.mjs then renders s2d/context
// into the doc site under docs/context/, exactly like every other source tree.
//
// It is called from two places that share this one implementation:
//   1. minting / doc-site build  -- ingest at creation when inputs exist.
//   2. the /wiki-update command   -- re-run to fold in artifacts added later.
//
// Idempotent: deterministic slugs, sorted iteration, overwrite-in-place. Running
// it twice on the same inputs yields a stable diff. Prose is normalized to the
// ASCII house style so generated pages pass prose-lint.
//
// Binary extraction uses optional deps (mammoth, pdf-parse, xlsx). If a parser
// is not installed, a file fails to parse, or an artifact extracts to an empty /
// near-empty body, the run FAILS LOUDLY: the failure is recorded and the process
// exits non-zero rather than overwriting the source-of-truth page with a stub.
// This guard prevents the silent-truncation data-loss regression (a run without
// the parsers installed once emptied committed content). See lib/nonempty.mjs.
//
// No absolute machine paths are ever written into committed files: every emitted
// link is repo-relative or a site-root web path.
//
// Power-of-10 in spirit: every loop is bounded by a constant cap, fs returns are
// checked, functions are small and named, inputs are asserted before use.

import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync
} from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeProse } from './lib/normalize-prose.mjs'
import { assertNonEmptyExtraction } from './lib/nonempty.mjs'

// Hard caps so no loop can run unbounded.
const MAX_FILES = 2000
const MAX_DEPTH = 8
const MAX_SHEETS = 20
const MAX_TABLE_ROWS = 500
const MAX_TABLE_COLS = 40
const MAX_SLUG_LEN = 80

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const DOC_EXT = new Set(['.docx', '.pdf'])
const SHEET_EXT = new Set(['.xlsx', '.xls'])

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

// Resolve the brain root: honor an explicit --brain <path>, else use the current
// working directory (the brain root when run via npm), else the script's parent.
function resolveRoot() {
  const idx = process.argv.indexOf('--brain')
  if (idx >= 0 && typeof process.argv[idx + 1] === 'string') {
    return process.argv[idx + 1]
  }
  const cwd = process.cwd()
  if (existsSync(join(cwd, 's2d')) || existsSync(join(cwd, 'knowledge'))) {
    return cwd
  }
  return join(SCRIPT_DIR, '..')
}

const ROOT = resolveRoot()
const INPUTS = join(ROOT, 's2d', 'inputs')
const KNOWLEDGE = join(ROOT, 'knowledge')
const OUT = join(ROOT, 's2d', 'context')
const PUBLIC = join(ROOT, 'docs', 'public', 'assets', 'context')
const MANIFEST = join(ROOT, 's2d', 'context.manifest.json')

function assert(cond, message) {
  if (!cond) {
    throw new Error(`context-ingest: ${message}`)
  }
}

function log(message) {
  process.stdout.write(`context-ingest: ${message}\n`)
}

function warn(message) {
  process.stdout.write(`context-ingest: WARN ${message}\n`)
}

function ensureDir(dir) {
  assert(typeof dir === 'string' && dir.length > 0, 'ensureDir needs a path')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return existsSync(dir)
}

// Deterministic slug from a path or label. Drops any extension, lowercases, and
// collapses non-alphanumerics to single hyphens. Bounded length.
function slugify(input) {
  const noExt = String(input).replace(/\.[a-z0-9]+$/i, '')
  const s = noExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LEN)
  return s.length > 0 ? s : 'item'
}

// A human title from a relative path: the base name without extension, with
// separators turned into spaces. Normalized so it is safe in a heading.
function titleFor(rel) {
  const base = basename(rel).replace(/\.[a-z0-9]+$/i, '')
  return normalizeProse(base.replace(/[-_]+/g, ' ')).trim() || 'Untitled'
}

// Tokens that should be upper-cased in a display title rather than title-cased.
const TITLE_ACRONYMS = new Set(['aws', 'd2c', 'ui', 'ux', 'api', 'poc', 's2d', 'db', 'sdk', 'mlp', 'mvp', 'prfaq', 'tco', 'adr', 'ci', 'cd'])

// A clean, presentable title for a media/diagram page: start from titleFor, then
// title-case each word and upper-case known acronyms. Turns a lowercased source
// filename like "scribl-aws-architecture-d2c" into "Scribl AWS Architecture D2C".
// Bounded by the word count; pure string work.
function mediaTitle(rel) {
  const words = titleFor(rel).split(/\s+/).filter((w) => w.length > 0)
  const out = []
  for (let i = 0; i < words.length && i < 40; i += 1) {
    const w = words[i]
    const lower = w.toLowerCase()
    if (TITLE_ACRONYMS.has(lower)) {
      out.push(lower.toUpperCase())
    } else {
      out.push(w.charAt(0).toUpperCase() + w.slice(1))
    }
  }
  return out.join(' ') || 'Untitled'
}

// List every file under a directory, bounded by MAX_FILES and MAX_DEPTH, sorted
// for deterministic output. Explicit stack so recursion stays traceable.
function collectFiles(dir) {
  const found = []
  if (!existsSync(dir)) {
    return found
  }
  const stack = [{ path: dir, depth: 0 }]
  let guard = 0
  while (stack.length > 0 && guard < MAX_FILES) {
    guard += 1
    const node = stack.pop()
    if (node.depth > MAX_DEPTH) {
      continue
    }
    const entries = readdirSync(node.path, { withFileTypes: true })
    for (let i = 0; i < entries.length && found.length < MAX_FILES; i += 1) {
      const entry = entries[i]
      if (entry.name === '.gitkeep') {
        continue
      }
      const full = join(node.path, entry.name)
      if (entry.isDirectory()) {
        stack.push({ path: full, depth: node.depth + 1 })
      } else if (entry.isFile()) {
        found.push(full)
      }
    }
  }
  assert(guard < MAX_FILES, 'collectFiles hit the file cap; raise MAX_FILES or split the tree')
  found.sort()
  return found
}

// Dynamically load an optional parser dependency. Returns null when the module
// is not installed so callers can warn-and-skip instead of crashing.
async function loadLib(name) {
  try {
    return await import(name)
  } catch {
    return null
  }
}

async function extractDocx(abs) {
  const mod = await loadLib('mammoth')
  if (mod === null) {
    return { ok: false, reason: 'mammoth not installed' }
  }
  try {
    const mammoth = mod.default || mod
    const res = await mammoth.extractRawText({ path: abs })
    return { ok: true, text: res && typeof res.value === 'string' ? res.value : '' }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}

async function extractPdf(abs) {
  // Import the library entrypoint directly. pdf-parse's index.js runs a debug
  // block that reads a bundled test file when module.parent is falsy (which it
  // is under ESM import), throwing at load time; the lib file has no such block.
  const mod = (await loadLib('pdf-parse/lib/pdf-parse.js')) || (await loadLib('pdf-parse'))
  if (mod === null) {
    return { ok: false, reason: 'pdf-parse not installed' }
  }
  try {
    const pdf = mod.default || mod
    const data = await pdf(readFileSync(abs))
    return { ok: true, text: data && typeof data.text === 'string' ? data.text : '' }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}

async function extractSheets(abs) {
  const mod = await loadLib('xlsx')
  if (mod === null) {
    return { ok: false, reason: 'xlsx not installed' }
  }
  try {
    const XLSX = mod.default || mod
    const wb = XLSX.read(readFileSync(abs), { type: 'buffer' })
    const names = (wb.SheetNames || []).slice(0, MAX_SHEETS)
    const sheets = []
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i]
      const ws = wb.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
      sheets.push({ name, rows: Array.isArray(rows) ? rows : [] })
    }
    return { ok: true, sheets }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}

// Render a 2D row array as a GitHub-flavored markdown table, bounded and with
// cells normalized and pipe-escaped. Returns a string.
function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '_(empty sheet)_'
  }
  const capped = rows.slice(0, MAX_TABLE_ROWS)
  let ncol = 0
  for (let i = 0; i < capped.length; i += 1) {
    ncol = Math.max(ncol, Array.isArray(capped[i]) ? capped[i].length : 0)
  }
  ncol = Math.min(ncol, MAX_TABLE_COLS)
  if (ncol === 0) {
    return '_(empty sheet)_'
  }
  const cell = (v) => {
    const s = normalizeProse(v === null || v === undefined ? '' : String(v))
    const flat = s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
    return flat.length > 0 ? flat : ' '
  }
  const pad = (arr) => {
    const r = (Array.isArray(arr) ? arr.slice(0, ncol) : []).map(cell)
    while (r.length < ncol) r.push(' ')
    return r
  }
  const lines = []
  lines.push('| ' + pad(capped[0]).join(' | ') + ' |')
  lines.push('| ' + new Array(ncol).fill('---').join(' | ') + ' |')
  for (let i = 1; i < capped.length; i += 1) {
    lines.push('| ' + pad(capped[i]).join(' | ') + ' |')
  }
  let out = lines.join('\n')
  if (rows.length > MAX_TABLE_ROWS) {
    out += `\n\n_Showing the first ${MAX_TABLE_ROWS} of ${rows.length} rows._`
  }
  return out
}

// Write a page under s2d/context/. The body is markdown only (no frontmatter):
// docs-sync adds the title frontmatter and its generated banner when rendering.
function writePage(relPath, body) {
  const abs = join(OUT, relPath)
  ensureDir(dirname(abs))
  const text = body.endsWith('\n') ? body : body + '\n'
  writeFileSync(abs, text, 'utf8')
  assert(existsSync(abs), `page write failed: ${relPath}`)
  return abs
}

// A short repo-relative source line placed under a page heading, so a reader
// (and prose-lint) sees provenance without an absolute path.
function sourceLine(relFromRoot) {
  return `_Source artifact: \`${relFromRoot}\`. Generated by context-ingest; do not hand-edit._`
}

// Provenance as an HTML comment: keeps the "do not hand-edit" warning in the page
// source without rendering it as body text. Used on clean per-diagram pages.
function sourceComment(relFromRoot) {
  return `<!-- Source artifact: \`${relFromRoot}\`. Generated by context-ingest; do not hand-edit. -->`
}

// Resolve a relative link target against the directory of its source markdown
// file. Returns an absolute path, or null on any failure. Bounded, no throw.
function resolvePathSafe(srcAbs, target) {
  try {
    const clean = String(target).split('#')[0].split('?')[0]
    if (clean.length === 0) return null
    return join(dirname(srcAbs), decodeURIComponent(clean))
  } catch {
    return null
  }
}

// Rewrite relative asset references inside copied markdown so the doc site
// builds. Relative image embeds are pointed at the copied public asset when the
// image was ingested, otherwise replaced with a caption (the bundler would fail
// on an unresolved local image import). Relative links to non-markdown local
// files are demoted to plain text. Web, absolute, and markdown links are left
// intact. Bounded by the input length; a single pass per pattern.
function rewriteAssets(md, srcAbs, imageByAbs) {
  const isExternal = (t) => /^(https?:|\/|#|data:|mailto:|tel:)/i.test(t)
  let out = md.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (m, alt, target) => {
    if (isExternal(target)) return m
    const abs = resolvePathSafe(srcAbs, target)
    if (abs && imageByAbs.has(abs)) {
      return `![${alt}](${imageByAbs.get(abs)})`
    }
    return `_(image omitted: ${basename(String(target).split('#')[0])})_`
  })
  out = out.replace(/\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (m, text, target) => {
    if (isExternal(target)) return m
    const clean = String(target).split('#')[0]
    if (clean.length === 0 || /\.md$/i.test(clean)) return m
    return text
  })
  return out
}

// Copy an image into docs/public/assets/context/ under a deterministic slug and
// return its site-root web path. Bounded, checked. Reuses the inputs-relative
// slug when the source lives under s2d/inputs so callers agree on the name.
function ingestImage(abs, slug, ext) {
  ensureDir(PUBLIC)
  const fileName = `${slug}${ext}`
  const dest = join(PUBLIC, fileName)
  copyFileSync(abs, dest)
  assert(existsSync(dest), `image copy failed: ${fileName}`)
  return `/assets/context/${fileName}`
}

// Build one composed page from a manifest entry. Bounded includes. Any missing
// source is noted in-page rather than aborting the run.
async function buildComposed(entry, model, imageByAbs) {
  if (!entry || typeof entry.id !== 'string') {
    warn('skipping malformed composed manifest entry')
    return
  }
  const id = slugify(entry.id)
  const title = normalizeProse(typeof entry.title === 'string' ? entry.title : entry.id)
  const lines = [`# ${title}`, '']
  lines.push('_Composed page generated by context-ingest from project artifacts; do not hand-edit._', '')
  if (typeof entry.intro === 'string' && entry.intro.length > 0) {
    lines.push(normalizeProse(entry.intro), '')
  }

  if (typeof entry.image === 'string') {
    const imgAbs = join(ROOT, entry.image)
    if (existsSync(imgAbs)) {
      const ext = extname(imgAbs).toLowerCase()
      const relFromInputs = relative(INPUTS, imgAbs)
      const underInputs = !relFromInputs.startsWith('..')
      const slug = slugify(underInputs ? relFromInputs : relative(ROOT, imgAbs))
      const web = ingestImage(imgAbs, slug, ext)
      lines.push('## Architecture diagram', '', `![${title}](${web})`, '')
    } else {
      warn(`composed ${id}: image not found: ${entry.image}`)
      lines.push('## Architecture diagram', '', `_Image not found: \`${entry.image}\`._`, '')
    }
  }

  if (typeof entry.spreadsheet === 'string') {
    const xAbs = join(ROOT, entry.spreadsheet)
    if (existsSync(xAbs)) {
      const res = await extractSheets(xAbs)
      lines.push(`## Cost model (from \`${entry.spreadsheet}\`)`, '')
      if (res.ok) {
        const wanted = typeof entry.spreadsheet_sheet === 'string' ? entry.spreadsheet_sheet : null
        const chosen = wanted
          ? res.sheets.find((s) => s.name === wanted)
          : res.sheets[0]
        if (chosen) {
          lines.push(`Sheet: **${normalizeProse(chosen.name)}**`, '', renderTable(chosen.rows), '')
        } else {
          lines.push(`_Sheet not found: ${wanted}._`, '')
        }
      } else {
        warn(`composed ${id}: spreadsheet parse skipped (${res.reason})`)
        lines.push(`_Spreadsheet not parsed: ${res.reason}._`, '')
      }
    } else {
      warn(`composed ${id}: spreadsheet not found: ${entry.spreadsheet}`)
    }
  }

  const includes = Array.isArray(entry.include) ? entry.include.slice(0, MAX_FILES) : []
  if (includes.length > 0) {
    lines.push('## Research notes', '')
    for (let i = 0; i < includes.length; i += 1) {
      const incAbs = join(ROOT, includes[i])
      if (existsSync(incAbs)) {
        lines.push(`### ${titleFor(includes[i])}`, '')
        lines.push(sourceLine(includes[i]), '')
        lines.push(rewriteAssets(normalizeProse(readFileSync(incAbs, 'utf8')), incAbs, imageByAbs || new Map()), '')
      } else {
        warn(`composed ${id}: include not found: ${includes[i]}`)
      }
    }
  }

  writePage(`${id}.md`, lines.join('\n'))
  model.composed.push({ id, title })
}

// Build the Context Information landing / overview index page. Regenerated each
// run from the model so the overview always reflects current artifacts.
function writeIndex(model) {
  const lines = ['# Project Information', '']
  lines.push(
    '_This section is generated by context-ingest from the project input',
    "artifacts (`s2d/inputs/`) and knowledge base (`knowledge/`). Regenerate with",
    '`npm run wiki:update`. Do not hand-edit pages under this section._',
    ''
  )
  lines.push('## Overview', '')
  lines.push(
    `- Documents extracted: ${model.documents.length}`,
    `- Data / cost tables: ${model.data.length}`,
    `- Architecture designs (images): ${model.media.length}`,
    `- Reference pages: ${model.reference.length}`,
    `- Knowledge notes: ${model.knowledgeCount}`,
    `- Composed pages: ${model.composed.length}`,
    ''
  )

  if (model.composed.length > 0) {
    lines.push('## Featured pages', '')
    for (const c of model.composed) lines.push(`- [${c.title}](./${c.id})`)
    lines.push('')
  }
  if (model.documents.length > 0) {
    lines.push('## Documents', '')
    for (const d of model.documents) lines.push(`- [${d.title}](./documents/${d.slug})`)
    lines.push('')
  }
  if (model.data.length > 0) {
    lines.push('## Data and cost models', '')
    for (const d of model.data) lines.push(`- [${d.title}](./data/${d.slug})`)
    lines.push('')
  }
  if (model.media.length > 0) {
    lines.push('## Architecture Designs', '')
    lines.push('- [Architecture Designs](./media/)', '')
  }
  if (model.reference.length > 0) {
    lines.push('## Reference', '')
    for (const r of model.reference) lines.push(`- [${r.title}](./pages/${r.link})`)
    lines.push('')
  }
  lines.push('## Knowledge base', '')
  lines.push('The project knowledge base is rendered under [Knowledge](/knowledge/).', '')

  writePage('index.md', lines.join('\n'))
}

async function main() {
  if (!existsSync(INPUTS) && !existsSync(KNOWLEDGE)) {
    log('no s2d/inputs or knowledge directory; nothing to ingest')
    return 0
  }
  ensureDir(OUT)

  const model = {
    documents: [], data: [], media: [], reference: [], other: [], composed: [], knowledgeCount: 0
  }

  const inputFiles = collectFiles(INPUTS)
  const imageByAbs = new Map()
  const mdPending = []
  // Empty/near-empty extractions are collected here and turned into a non-zero
  // exit at the end of the run, so a truncating extraction can never silently
  // overwrite a committed page. See lib/nonempty.mjs.
  const extractionFailures = []

  // First pass: images (build the map), documents, spreadsheets, and other.
  // Markdown is deferred so its relative image links can be rewritten against a
  // complete image map regardless of file ordering.
  for (let i = 0; i < inputFiles.length; i += 1) {
    const abs = inputFiles[i]
    const rel = relative(INPUTS, abs)
    const relFromRoot = relative(ROOT, abs)
    const ext = extname(abs).toLowerCase()
    try {
      if (IMAGE_EXT.has(ext)) {
        const slug = slugify(rel)
        const web = ingestImage(abs, slug, ext)
        imageByAbs.set(abs, web)
        // Only root-level input images become standalone Architecture Designs
        // pages. An image nested inside reference material is embedded within
        // that reference page (its link is rewritten to the served asset above),
        // so we do not also emit a duplicate top-level media page for it.
        if (!rel.includes('/')) {
          const title = mediaTitle(rel)
          model.media.push({ slug, title, web, rel })
          // One clean page per diagram, mirroring the design-history per-item pattern.
          const body = [`# ${title}`, '', sourceComment(relFromRoot), '', `![${title}](${web})`, '']
          writePage(join('media', `${slug}.md`), body.join('\n'))
        }
      } else if (DOC_EXT.has(ext)) {
        const res = ext === '.docx' ? await extractDocx(abs) : await extractPdf(abs)
        const slug = slugify(rel)
        const title = mediaTitle(rel)
        if (!res.ok) {
          // Parser missing or the file failed to parse: do NOT overwrite the
          // existing page with a stub. Record the failure so the run exits
          // non-zero, leaving any prior good content on disk untouched.
          extractionFailures.push({ rel, reason: res.reason })
          warn(`extraction failed ${rel}: ${res.reason}`)
        } else {
          const extracted = normalizeProse(res.text).trim()
          try {
            assertNonEmptyExtraction('document', rel, extracted)
            const body = [`# ${title}`, '', sourceLine(relFromRoot), '', extracted, '']
            writePage(join('documents', `${slug}.md`), body.join('\n'))
            model.documents.push({ slug, title, ok: true })
          } catch (e) {
            extractionFailures.push({ rel, reason: String((e && e.message) || e) })
            warn(`extraction failed ${rel}: ${String((e && e.message) || e)}`)
          }
        }
      } else if (SHEET_EXT.has(ext) && !rel.includes('/')) {
        // Only root-level spreadsheets become standalone Data pages. A sheet
        // nested inside reference material is linked for download from its
        // reference page, so it falls through to `other` rather than getting a
        // duplicate top-level Data page.
        const res = await extractSheets(abs)
        const slug = slugify(rel)
        const title = mediaTitle(rel)
        if (!res.ok) {
          extractionFailures.push({ rel, reason: res.reason })
          warn(`extraction failed ${rel}: ${res.reason}`)
        } else {
          const sections = []
          for (let s = 0; s < res.sheets.length; s += 1) {
            const sheet = res.sheets[s]
            sections.push(`## ${normalizeProse(sheet.name)}`, '', renderTable(sheet.rows), '')
          }
          const rendered = sections.join('\n').trim()
          try {
            assertNonEmptyExtraction('spreadsheet', rel, rendered)
            const body = [`# ${title}`, '', sourceLine(relFromRoot), '', rendered, '']
            writePage(join('data', `${slug}.md`), body.join('\n'))
            model.data.push({ slug, title, ok: true })
          } catch (e) {
            extractionFailures.push({ rel, reason: String((e && e.message) || e) })
            warn(`extraction failed ${rel}: ${String((e && e.message) || e)}`)
          }
        }
      } else if (ext === '.md') {
        mdPending.push({ abs, rel, relFromRoot })
      } else {
        model.other.push({ rel })
      }
    } catch (e) {
      warn(`error processing ${rel}: ${String((e && e.message) || e)}`)
    }
  }

  // Second pass: markdown reference pages, with relative asset links rewritten.
  for (let i = 0; i < mdPending.length && i < MAX_FILES; i += 1) {
    const { abs, rel, relFromRoot } = mdPending[i]
    try {
      const raw = normalizeProse(readFileSync(abs, 'utf8')).trim()
      const rewritten = rewriteAssets(raw, abs, imageByAbs)
      // If the source already leads with its own H1, keep that as the page
      // heading (and the sidebar title) rather than prepending a duplicate
      // lower-cased heading; otherwise title-case a heading from the filename.
      const lines = rewritten.split('\n')
      const leadsWithH1 = /^#\s+/.test(lines[0] || '')
      const title = leadsWithH1 ? lines[0].replace(/^#\s+/, '').trim() : mediaTitle(rel)
      const rest = leadsWithH1 ? lines.slice(1).join('\n').trim() : rewritten
      const body = [`# ${title}`, '', sourceLine(relFromRoot), '', rest, '']
      // Mirror the source subpath under pages/, so links stay stable.
      writePage(join('pages', rel), body.join('\n'))
      model.reference.push({ title, link: rel.replace(/\.md$/i, ''), rel })
    } catch (e) {
      warn(`error processing ${rel}: ${String((e && e.message) || e)}`)
    }
  }

  // Architecture Designs landing page: a gallery index linking each per-diagram
  // page. Written only when at least one image was ingested.
  if (model.media.length > 0) {
    const indexLines = ['# Architecture Designs', '']
    for (let i = 0; i < model.media.length; i += 1) {
      const m = model.media[i]
      indexLines.push(`- [${m.title}](./${m.slug})`)
    }
    indexLines.push('')
    writePage(join('media', 'index.md'), indexLines.join('\n'))
  }

  // Knowledge is rendered into the site by docs-sync (knowledge -> docs/knowledge);
  // here we only count notes so the overview is accurate.
  model.knowledgeCount = collectFiles(KNOWLEDGE).filter((f) => f.toLowerCase().endsWith('.md')).length

  // Composed pages (manifest-driven); optional.
  if (existsSync(MANIFEST)) {
    let manifest = null
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    } catch (e) {
      warn(`manifest parse failed: ${String((e && e.message) || e)}`)
    }
    if (manifest && Array.isArray(manifest.composed)) {
      const entries = manifest.composed.slice(0, MAX_FILES)
      for (let i = 0; i < entries.length; i += 1) {
        await buildComposed(entries[i], model, imageByAbs)
      }
    }
  }

  writeIndex(model)

  if (model.other.length > 0) {
    log(`noted ${model.other.length} unextracted artifact(s): ${model.other.map((o) => o.rel).join(', ')}`)
  }
  log(
    `ingested ${model.documents.length} document(s), ${model.data.length} data table page(s), ` +
    `${model.media.length} image(s), ${model.reference.length} reference page(s), ` +
    `${model.composed.length} composed page(s); ${model.knowledgeCount} knowledge note(s) counted`
  )

  // Fail loudly if any artifact extracted to an empty / near-empty body (missing
  // parser, parse error, or truncation). Exiting non-zero here halts wiki:update
  // before docs-sync runs, so a truncating extraction can never be committed.
  if (extractionFailures.length > 0) {
    process.stderr.write(
      `context-ingest: ${extractionFailures.length} extraction(s) produced no usable content ` +
      `-- refusing to write truncated pages:\n`
    )
    for (let i = 0; i < extractionFailures.length && i < MAX_FILES; i += 1) {
      const f = extractionFailures[i]
      process.stderr.write(`  - ${f.rel}: ${f.reason}\n`)
    }
    process.stderr.write(
      'Install the extraction deps (mammoth, pdf-parse, xlsx) and re-run, ' +
      'or remove the offending artifact from s2d/inputs/.\n'
    )
    return 1
  }
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(`context-ingest: fatal ${String((e && e.stack) || e)}\n`)
    process.exit(1)
  })
