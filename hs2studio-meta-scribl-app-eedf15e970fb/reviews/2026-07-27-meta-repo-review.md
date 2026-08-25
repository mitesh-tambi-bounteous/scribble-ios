---
stage: Meta-repo review and cleanup
date: 2026-07-27
---

# Review: meta-repo review, wiki cleanup and Expo rebuild epic dataset

Full review of the meta repo ahead of the POC -> prototype push: immediate
fixes, wiki cleanup for team review, knowledge-format assessment, and the
epic/feature dataset for a ground-up Expo rebuild.

## What was found

- The docs-sync pipeline was healthy: all generated pages byte-matched their
  sources, and board/story column placement had zero drift. Link hygiene was
  good (4 broken links total, all in inbox files that were duplicates anyway).
- The real damage was metadata and structure: the documented clone URL could
  not work (GitHub URL with a typo for a Bitbucket-hosted repo), CLAUDE.md
  pointed at an ADR directory that does not exist, four hand-edited pages
  lived inside the generated docs/ tree with no source (a latent build
  breaker), five Done stories had zero AC boxes checked, and the roadmap and
  status pages disagreed on milestone membership while both missed the
  shipped iOS/Android distribution work.
- The knowledge wiki is a near-conformant port of the brain conventions and
  close to Google OKF already; see the
  [knowledge-format assessment](2026-07-27-knowledge-format-assessment.md).

## What was done

- Repo identity fixed (CLAUDE.md, README.md, project.json point at the real
  Bitbucket coordinates); ADR path corrected; tracking board, roadmap and
  status reconciled, M6 advanced to In progress with the build evidence.
- AC closed out on the five Done stories with retroactive closeout notes;
  S-007 vs S-013 parity contradiction resolved with a scope note on S-007.
- Wiki cleanup: OKF cheap fixes applied (frontmatter on research notes,
  title/description keys, log newest-first, markdown-link convention declared
  and agent definitions reworded, raw/ boundary documented).
- Structure: design-history moved to s2d/ source, reviews/ wired into
  docs-sync, orphan spec relocated, normalize-prose made idempotent with a
  new test, inbox duplicates deleted.
- New deliverables: [Expo rebuild epics](/expo-rebuild-epics)
  (MVP vs future, challenge mode explicitly post-MVP) and the
  [generator-upgrade note](2026-07-27-generator-upgrade-note.md).

## Judgment calls (flagging every one)

1. **Brand rule not enforced.** CLAUDE.md bans naming "the legacy consulting
   firm" but never says which name. The review found 216 hits of the current
   firm's name across sources, propagating to 32 site pages. Since that is
   the current firm, not a legacy one, nothing was scrubbed. The rule needs
   its target named or it stays unenforceable; routed to the generator note.
2. **AC ticked retroactively** on S-001/002/006/007/008 based on the board's
   shipped/merged record, not fresh verification against the app. Each story
   carries a closeout note saying exactly that.
3. **ADR-0004 filename left as-is.** The file is named for DynamoDB but the
   decision inside is Aurora (revised upstream). It lives in the verbatim
   inputs tree, so it was flagged rather than renamed. Rename or supersede
   with an ADR-0012 when ADRs get ratified.
4. **AI enhancement pipeline scoped as post-MVP** in the rebuild dataset,
   because the client MVP-scope doc's six areas do not include it, even
   though it is proven in the POC. Marked for the team to challenge.
5. **S-020/021/022 left in Blocked** although they are review-wait, not
   dependency-blocked. A "pending review" state is a generator-note item.
6. **The 2026-07-01 loom-loop spec moved to reviews/** as the least-bad home
   for a hand-written doc that was parked invisibly under docs/.
7. **updated: frontmatter not backfilled** on the 23 stories; the template
   now includes it so new stories carry it going forward.

## What to improve

Friction and structural fixes are captured as a ready-to-lift work order in
the [generator-upgrade note](2026-07-27-generator-upgrade-note.md): DoD/DoR
and AC-closeout baked into story-sync, OKF-conformant knowledge authoring,
docs-sync orphan pruning, repo identity derived from git remotes, and
mechanically checkable prose-lint rules.
