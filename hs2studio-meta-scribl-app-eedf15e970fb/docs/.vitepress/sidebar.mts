// sidebar.mts -- generate VitePress sidebar item lists from the docs/ file
// tree so individual pages can never go stale relative to the sidebar.
//
// Imported by config.ts (VitePress config runs in Node, so node:fs/node:path
// are available directly from a .mts file).
//
// Power-of-10 in spirit: small named functions, bounded loops with explicit
// caps, asserted invariants, no unbounded recursion (each tree shape below is
// known and walked explicitly rather than via a generic recursive walker).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Hard caps so no loop can run unbounded.
const MAX_ENTRIES = 500

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DOCS = join(SCRIPT_DIR, '..')

interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(`sidebar: ${message}`)
  }
}

// Turn a filename (no extension) into a readable fallback title.
function humanize(name: string): string {
  const words = name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim().split(' ')
  return words
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Derive a display title for a markdown file: first H1 heading, else the
// generated frontmatter `title:` (with any "Group: " prefix stripped), else a
// humanized filename.
function titleFor(fileAbs: string, fallbackName: string): string {
  assert(typeof fileAbs === 'string' && fileAbs.length > 0, 'titleFor needs a path')
  const body = readFileSync(fileAbs, 'utf8')
  const lines = body.split('\n')
  for (let i = 0; i < lines.length && i < MAX_ENTRIES; i += 1) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/)
    if (m) {
      return m[1]
    }
  }
  const fm = body.match(/^title:\s*"?(.+?)"?\s*$/m)
  if (fm) {
    const raw = fm[1]
    const idx = raw.lastIndexOf(': ')
    return idx >= 0 ? raw.slice(idx + 2) : raw
  }
  return humanize(fallbackName)
}

// List markdown files directly in a directory, excluding index/README pages.
// Returns bare filenames (with extension), not full paths.
function listMarkdownFiles(dirAbs: string): string[] {
  if (!existsSync(dirAbs)) {
    return []
  }
  const entries = readdirSync(dirAbs, { withFileTypes: true })
  assert(entries.length <= MAX_ENTRIES, `too many entries in ${dirAbs}`)
  const out: string[] = []
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i]
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.md')) {
      continue
    }
    const lower = e.name.toLowerCase()
    if (lower === 'index.md' || lower === 'readme.md') {
      continue
    }
    out.push(e.name)
  }
  return out
}

function stripExt(name: string): string {
  return name.replace(/\.md$/i, '')
}

// Build one sidebar item for a markdown file under a route prefix.
function itemFor(dirAbs: string, fileName: string, routePrefix: string): SidebarItem {
  const fileAbs = join(dirAbs, fileName)
  const text = titleFor(fileAbs, fileName)
  const link = `${routePrefix}${stripExt(fileName)}`
  return { text, link }
}

// Strip a leading story-number prefix ("S-001 -- ", ...) from a display label,
// leaving just the story title. Ordering is unaffected (filename localeCompare).
function stripStoryPrefix(text: string): string {
  return text.replace(/^S-\d+\s+--\s+/, '')
}

// ---- Stories: natural filename sort (S-001 < S-002 < ...). ----

export function buildStoriesSidebar(): SidebarItem[] {
  const dirAbs = join(DOCS, 'stories')
  const files = listMarkdownFiles(dirAbs)
  files.sort((a, b) => a.localeCompare(b))
  return files.map((f) => {
    const item = itemFor(dirAbs, f, '/stories/')
    return { ...item, text: stripStoryPrefix(item.text) }
  })
}

// ---- Reviews: per-stage reviews synced from reviews/ by docs-sync. ----

export function buildReviewsSidebar(): SidebarItem[] {
  const dirAbs = join(DOCS, 'reviews')
  const files = listMarkdownFiles(dirAbs).sort((a, b) => a.localeCompare(b))
  return files.map((f) => itemFor(dirAbs, f, '/reviews/'))
}

// ---- Knowledge: meetings, then research, then PROVENANCE last. ----

export function buildKnowledgeSidebar(): SidebarItem[] {
  const rootAbs = join(DOCS, 'knowledge')
  const items: SidebarItem[] = []

  const meetingsAbs = join(rootAbs, 'meetings')
  const meetings = listMarkdownFiles(meetingsAbs).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < meetings.length; i += 1) {
    items.push(itemFor(meetingsAbs, meetings[i], '/knowledge/meetings/'))
  }

  const researchAbs = join(rootAbs, 'research')
  const research = listMarkdownFiles(researchAbs).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < research.length; i += 1) {
    items.push(itemFor(researchAbs, research[i], '/knowledge/research/'))
  }

  const rootFiles = listMarkdownFiles(rootAbs).filter((f) => f.toLowerCase() !== 'provenance.md')
  rootFiles.sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < rootFiles.length; i += 1) {
    items.push(itemFor(rootAbs, rootFiles[i], '/knowledge/'))
  }

  if (existsSync(join(rootAbs, 'PROVENANCE.md'))) {
    items.push(itemFor(rootAbs, 'PROVENANCE.md', '/knowledge/'))
  }

  return items
}

// ---- Workshops: workshop retros filed under knowledge/wiki/sources. ----
//
// Workshop retros are wiki source pages (source-type: workshop) filed under
// knowledge/wiki/sources; docs-sync preserves each page's own frontmatter in
// the synced body, so a `source-type: workshop` line reliably marks one. This
// keeps the wiki-ingestor filing convention intact while giving the site a
// dedicated Workshops section that never goes stale.

const WORKSHOP_SOURCES_ROUTE = '/knowledge/wiki/sources/'

function isWorkshopSource(fileAbs: string): boolean {
  assert(typeof fileAbs === 'string' && fileAbs.length > 0, 'isWorkshopSource needs a path')
  const body = readFileSync(fileAbs, 'utf8')
  return /^source-type:\s*workshop\b/m.test(body)
}

// Newest first: workshop filenames lead with an ISO date, so reverse sort.
export function buildWorkshopsSidebar(): SidebarItem[] {
  const dirAbs = join(DOCS, 'knowledge/wiki/sources')
  const files = listMarkdownFiles(dirAbs).filter((f) => isWorkshopSource(join(dirAbs, f)))
  files.sort((a, b) => b.localeCompare(a))
  return files.map((f) => itemFor(dirAbs, f, WORKSHOP_SOURCES_ROUTE))
}

// The most recent workshop page route, or null if none have landed yet. Used
// for the top-nav Workshops entry so it points at the latest retro.
export function latestWorkshopLink(): string | null {
  const items = buildWorkshopsSidebar()
  return items.length > 0 ? items[0].link ?? null : null
}

// ---- Context: nested groups mirroring disk structure. ----

// Decisions (ADRs) sort numerically by their leading NNNN- prefix.
function decisionRank(fileName: string): number {
  const m = fileName.match(/^(\d+)-/)
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
}

function buildFlatGroup(dirAbs: string, routePrefix: string, text: string): SidebarItem | null {
  const files = listMarkdownFiles(dirAbs).sort((a, b) => a.localeCompare(b))
  if (files.length === 0) {
    return null
  }
  return { text, collapsed: true, items: files.map((f) => itemFor(dirAbs, f, routePrefix)) }
}

function buildDecisionsGroup(): SidebarItem | null {
  const dirAbs = join(DOCS, 'context/pages/reference/decisions')
  const files = listMarkdownFiles(dirAbs).sort((a, b) => decisionRank(a) - decisionRank(b))
  if (files.length === 0) {
    return null
  }
  return {
    text: 'Decisions',
    collapsed: true,
    items: files.map((f) => itemFor(dirAbs, f, '/context/pages/reference/decisions/'))
  }
}

function buildPocGroup(): SidebarItem | null {
  const pocAbs = join(DOCS, 'context/pages/reference/poc')
  if (!existsSync(pocAbs)) {
    return null
  }
  const sub: SidebarItem[] = []
  // The POC architecture cost / TCO model is surfaced under the Future
  // Architecture (AWS) group in the design area, not here.
  const dna = buildFlatGroup(
    join(pocAbs, 'project-dna'),
    '/context/pages/reference/poc/project-dna/',
    'Project DNA'
  )
  if (dna) {
    sub.push(dna)
  }
  if (sub.length === 0) {
    return null
  }
  return { text: 'POC', collapsed: true, items: sub }
}

function buildReferenceGroup(): SidebarItem | null {
  const refAbs = join(DOCS, 'context/pages/reference')
  if (!existsSync(refAbs)) {
    return null
  }
  const items: SidebarItem[] = []
  const flat = listMarkdownFiles(refAbs).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < flat.length; i += 1) {
    items.push(itemFor(refAbs, flat[i], '/context/pages/reference/'))
  }
  const decisions = buildDecisionsGroup()
  if (decisions) {
    items.push(decisions)
  }
  const discussions = buildFlatGroup(
    join(refAbs, 'discussions'),
    '/context/pages/reference/discussions/',
    'Discussions'
  )
  if (discussions) {
    items.push(discussions)
  }
  const poc = buildPocGroup()
  if (poc) {
    items.push(poc)
  }
  if (items.length === 0) {
    return null
  }
  return { text: 'Reference', collapsed: true, items }
}

// Architecture Designs: one page per ingested diagram under context/media,
// with an index landing page. Emitted by context-ingest; skip gracefully if the
// directory has not landed yet (no images ingested).
function buildArchitectureGroup(): SidebarItem | null {
  const dirAbs = join(DOCS, 'context/media')
  if (!existsSync(dirAbs)) {
    return null
  }
  const items: SidebarItem[] = []
  const files = listMarkdownFiles(dirAbs).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < files.length; i += 1) {
    items.push(itemFor(dirAbs, files[i], '/context/media/'))
  }
  if (items.length === 0) {
    return null
  }
  return { text: 'Architecture Designs', collapsed: true, items }
}

// Future Architecture (AWS): the composed overview page plus its cost / TCO
// model, grouped together in the design area. The cost model is pulled up out of
// the POC reference tree so the future-state design and its economics sit side
// by side.
function buildFutureArchitectureGroup(): SidebarItem | null {
  const items: SidebarItem[] = []
  if (existsSync(join(DOCS, 'context/future-architecture-aws.md'))) {
    items.push({ text: 'Overview', link: '/context/future-architecture-aws' })
  }
  const costDir = join(DOCS, 'context/pages/reference/poc/architecture')
  if (existsSync(join(costDir, 'cost-model.md'))) {
    items.push(itemFor(costDir, 'cost-model.md', '/context/pages/reference/poc/architecture/'))
  }
  if (items.length === 0) {
    return null
  }
  return { text: 'Future Architecture (AWS)', collapsed: true, items }
}

// Design History is hand-maintained source at s2d/context/design-history,
// rendered here by docs-sync; skip gracefully if it has not been synced yet.
function buildDesignHistoryGroup(): SidebarItem | null {
  const dirAbs = join(DOCS, 'context/design-history')
  if (!existsSync(dirAbs)) {
    return null
  }
  const items: SidebarItem[] = []
  const files = listMarkdownFiles(dirAbs).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < files.length; i += 1) {
    items.push(itemFor(dirAbs, files[i], '/context/design-history/'))
  }
  if (items.length === 0) {
    return null
  }
  return { text: 'Design History', collapsed: true, items }
}

export function buildContextSidebar(): SidebarItem[] {
  const rootAbs = join(DOCS, 'context')
  const items: SidebarItem[] = []

  // The composed future-architecture page is surfaced in its own group below,
  // not as a loose top-level item.
  const loose = listMarkdownFiles(rootAbs)
    .filter((f) => f.toLowerCase() !== 'future-architecture-aws.md')
    .sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < loose.length; i += 1) {
    items.push(itemFor(rootAbs, loose[i], '/context/'))
  }

  const architecture = buildArchitectureGroup()
  if (architecture) {
    items.push(architecture)
  }

  const futureArchitecture = buildFutureArchitectureGroup()
  if (futureArchitecture) {
    items.push(futureArchitecture)
  }

  const documents = buildFlatGroup(join(rootAbs, 'documents'), '/context/documents/', 'Documents')
  if (documents) {
    items.push(documents)
  }

  const data = buildFlatGroup(join(rootAbs, 'data'), '/context/data/', 'Data')
  if (data) {
    items.push(data)
  }

  const reference = buildReferenceGroup()
  if (reference) {
    items.push(reference)
  }

  const designHistory = buildDesignHistoryGroup()
  if (designHistory) {
    items.push(designHistory)
  }

  return items
}
