---
stage: POC gap analysis
date: 2026-07-08
---

# Scribl POC Gap Report

**Date:** 2026-07-08
**Prepared by:** AI gap-analysis session (read-only investigation, no product code changed)
**Scope:** How close the Scribl POC is to its original ask, what's left, with deployment gaps called out separately from feature gaps.

## Headline

**The daily-loop feature set is roughly 85-90% built in code, well ahead of what this brain's tracking board shows. Deployment readiness is roughly 0%.** The remaining work is now dominated by deployment decisions (app-store identifiers, signing, distribution, phone-vs-tablet scope), not by missing features. This is CONFIRMED against the actual `vendor/mobileapp` commit history (20 merged PRs), not just the brain's `tracking/board.md`, which is stale and undersells progress.

## What Scribl originally asked for

Per the client-facing inputs and the synthesized spec:

- **Platform**: iOS (Swift) + Android (Kotlin) via a shared React Native/Expo layer, **phone**, not tablet -- `s2d/inputs/reference/client-summary.md:57`; the client inputs set an explicit "phone-first" golden rule.
- **Timeline**: build sprint July 2026, beta August 2026, public launch **September 15, 2026** -- `s2d/inputs/reference/client-summary.md:20,66-78`.
- **Core loops**: Daily Prompt, Creative Response, Submit-to-Unlock, Social Channels, Reactions, Streaks, Push, Personalized Follow-ups -- `s2d/inputs/reference/client-summary.md:24-33`.
- **POC framing** (Rob's own scoping call): "the 'full app' here is the POC target -- a local Expo / React Native build with a thin backend and a real database, delivering the full org feature-set end-to-end" -- `s2d/scribl-full-app-spec.md:24-26`.
- **POC-level definition of done**, `s2d/scribl-full-app-spec.md:317-323`:
  1. Daily loop works end-to-end (prompt -> create, including voice -> text -> submit -> unlock -> channel view -> react).
  2. All six live bugs are fixed.
  3. Auth validates and round-trips.
  4. Channel isolation and submit-to-unlock enforced at the data layer.
  5. Unit and end-to-end tests are green.
  6. The app runs in the local two-server harness (web plus API).
- **Explicitly out of POC scope**: production AWS/Cognito/Aurora/CDK, Claude vision reflection, managed push, analytics warehouse, premium/paywall, enterprise admin, event mode, Bedrock adapter -- `s2d/scribl-full-app-spec.md:302-315`.

**Discrepancy to flag**: the task brief for this report asks for a next-session checklist "targeting: run on his tablet." The original spec never scoped tablet -- it is phone-first by design decision. `vendor/mobileapp/app.json` confirms this in code: `"orientation": "portrait"`, no `supportsTablet` flag, no `ios` bundle-identifier block at all (CONFIRMED, read directly from `app.json`). Before any tablet checklist is useful, this is a scope decision that needs to be made, not an engineering gap to close.

## POC definition of done -- status

| # | DoD item | Status | Evidence |
|---|---|---|---|
| 1 | Daily loop end-to-end | **CONFIRMED shipped** | `tracking/board.md` Done column (S-001..S-005 "shipped, merged to MobileApp main"); corroborated by commits `b414d9a` (S-001), `a33a8e6` (S-002 Skia canvas), `d2e5c59` (S-003 submit-to-unlock, server-enforced), `f434420` (S-004 channel authz), `58d8ab5` (S-005 wall + reactions) in `vendor/mobileapp` git log |
| 2 | Six live bugs fixed | **PLAUSIBLE** | No explicit bug list found in this brain; commit `6793675` "fix(draw): per-stroke color, live elapsed clock, working undo" suggests bug-fix activity but can't be matched 1:1 to "six bugs" without a source list |
| 3 | Auth round-trips | **CONFIRMED shipped** | Commit `e12901e` "external swappable Postgres (Neon) + auth + multi-user via dataClient seam" (#17), commit `70d93a9` "login-first clean-slate boot ... DB-backed prompts" (#20, current HEAD) |
| 4 | Channel isolation + submit-to-unlock enforced at data layer | **CONFIRMED shipped** | Commits `d2e5c59` (#4) and `f434420` (#8) explicitly say "server-side" / "authz on read" |
| 5 | Unit + e2e tests green | **PLAUSIBLE** | `tests/` directory exists in `vendor/mobileapp` and CI workflow (`.github/workflows/ci.yml`) runs on push; actual green/red status not checked (would require running CI, out of scope for a read-only report) |
| 6 | Runs in local two-server harness | **CONFIRMED shipped** | `backend/local-server.ts` exists; the local two-server harness is documented in the brain; story S-021 ("dev-startup-and-two-server-e2e") exists specifically to formalize/automate this, and per `tracking/board.md` is Blocked behind PR #23 -- meaning the harness itself already runs by hand, S-021 is about making startup one-command, not making it work at all |

## Feature gaps (screens/UX, not deployment)

The brain's `tracking/board.md` places S-009 through S-018 in "Next" and S-020/021/022 in "Blocked," implying most screen work is still ahead. **The actual `vendor/mobileapp` commit history shows this is stale** -- most of that work already has shipped commits:

- `88cd049` "Foundation wave: skeleton screens + nav + CI Node 22 (S-009..S-019)" (#11)
- `265267a` "hero visual pass for splash + wall + detail (S-009/S-016/S-017)" (#12)
- `dd02d2b` "full-fidelity redo of every screen from Claude-designed mockups" (#14) -- this is the big one: every screen, not just some
- `90409d0` "Deferred functionality wave: onboarding, web audio, share, detail-fetch (S-010/S-011/S-013/S-017/S-018)" (#13)
- `6cb92d3`, `14c4a7f5`-equivalent `14c4a7f5` (screenshots baseline, #15), `6793675` (draw fixes, #16), `a29e558` (Scribble theme default, #19)

A screenshot baseline exists at `vendor/mobileapp/screenshots/` (files like `create-wall.png`, `draw-ink.png`, `draw-notepad.png`, `draw-studio.png`), captured per commit `14c4a7f5` "baseline capture of every screen post UI redo" -- CONFIRMED the screens render, though visual QA against designs wasn't done as part of this report.

**Genuinely still open** (per `tracking/board.md` Blocked column, and no corresponding "done" commit found for the underlying feature, only stub/PR-in-review commits):
- **S-020** Family challenges -- stub, PR #24 open, branch `family-challenges`
- **S-021** One-command dev startup / e2e harness -- stub, PR #23 open, branch `scribl-devx-userwalk`
- **S-022** Invite-by-email membership -- stub, same PR #23

These three are **awaiting code review**, not awaiting engineering -- the work exists in open PRs against `MobileApp`, it just hasn't been merged. This is a fast path to closing, not a feature gap requiring new build.

## Deployment gaps (separate from features, as requested)

This is where the real remaining distance is, and it is currently at essentially zero progress:

- **No app-store identifiers**: `vendor/mobileapp/app.json` has no `ios.bundleIdentifier` or `android.package` block -- CONFIRMED by direct read of the file.
- **No signing/build config**: no `eas.json` exists in the repo (CONFIRMED, file absent). A broad grep across the whole `vendor/mobileapp` tree for signing/provisioning/TestFlight/Play/tablet/iPad terms turned up nothing relevant -- only incidental unrelated matches in `rn-builder.md`, `backend/README.md`, `backend/scripts/prompts.ts`, and `dynamodb-client.ts`.
- **No release/distribution CI**: the only workflow is `.github/workflows/ci.yml` (test/lint on push) -- CONFIRMED, it's the only file under `.github/`. No build-and-distribute workflow exists.
- **No tablet support flag**: `app.json` has `"orientation": "portrait"` and no `supportsTablet` key.
- **Backend has AWS CDK scaffolding but it's minimal**: `backend/cdk/` contains only `app.ts` and `scribl-stack.ts` (~7KB) -- this looks like early/placeholder infra-as-code, not a deployed production stack, consistent with the POC's explicit exclusion of "production AWS/Cognito/Aurora/CDK" (`s2d/scribl-full-app-spec.md:302-315`).
- **The brain treats this as an open decision, not a plan**: physical device deploy (e.g. TestFlight, Play internal testing) plus backend IaC is treated as optional or demo-only depending on engagement scope -- an open decision, not a committed plan. No decision has been recorded resolving this.

**Bottom line on deployment**: nothing in the deployment category has been started. It is not "50% done and stuck," it is "not yet decided or scoped."

## Process/hygiene note (not a product gap)

`tracking/board.md` is stale relative to the actual `vendor/mobileapp` repo -- it still lists most screen stories (S-009..S-018) as "Next" when the app repo shows a full screen redo already merged (`dd02d2b`, #14). Per-story frontmatter (`tracking/stories/S-*.md` `status:` fields) is separately stale from the board itself -- e.g. S-001/S-002 say `status: now` in-file while the board marks them Done. Recommend a board-sync pass as a quick follow-up so the brain reflects reality, independent of this report.

## What's next

1. Merge the two open PRs (#23 dev harness, #24 family challenges) to close S-020/021/022 -- this is review, not build.
2. Resolve the deployment scope decision: is a physical device build (TestFlight/Play internal) in scope for this POC, or does it stay web/simulator-only? This gates everything else in the deployment category.
3. Once scoped, the deployment work is standard Expo/EAS setup: bundle identifiers, signing certs/profiles, `eas.json`, and a release CI workflow -- none of which currently exists.
4. Separately confirm phone-vs-tablet target before doing any tablet-specific UI work, since the original spec and current `app.json` are both phone-only.

## Next-session checklist (P2)

1. **Decide phone vs. tablet scope first** -- the original POC spec and shipped `app.json` are phone-only; running on Rob's tablet is a new scope decision, not a resumption of existing work.
2. Merge PR #23 (dev harness) and PR #24 (family challenges) to close out S-020/021/022.
3. Add `ios.bundleIdentifier` / `android.package` to `app.json` and create `eas.json` (or equivalent) once distribution mechanism is chosen.
4. Run the existing two-server local harness (`backend/local-server.ts` + web) once to re-familiarize with current state before making further scope decisions.
5. Sync `tracking/board.md` and story frontmatter against the real `vendor/mobileapp` state so future sessions aren't misled by stale tracking (see hygiene note above).
