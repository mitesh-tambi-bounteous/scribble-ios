---
type: research
title: "Research + plan: AI-enhanced drawing feature (original vs enhanced)"
description: Faithful extraction of the Mission Cloud POC artifact pipeline plus the plan for Scribl's in-app original-vs-enhanced drawing feature.
tags: [ai-enhancement, drawing, bedrock, poc]
date-ingested: 2026-07-09
---

<!-- source: "Scribl Artifact Generation -- POC Handover" (Mission Cloud Services, Inc., June 2026); input artifact at s2d/inputs/scribl-poc-handover-v2.pdf -->
<!-- date-ingested: 2026-07-09 -->

# Research + plan: AI-enhanced drawing feature (original vs enhanced)

Two parts. **Part 1** is a faithful extraction of the partner POC pipeline
documented in the handover. **Part 2** is the plan for a new Scribl feature that
shows a user's original drawing next to an AI-enhanced version, built as our own
implementation on the basis of that documented approach.

The North Star carried from Part 1 into Part 2: **the participant's art is never
regenerated.** It is only ever placed. The "enhancement" is the scene composed
around a pixel-perfect original.

---

## Part 1 -- Faithful extraction of the partner pipeline

### Engagement framing
- Vendor: Mission Cloud Services, Inc. (a CDW company). Client: Scribl, Inc.
- Fixed 120-hour, 3-week proof of concept, fully offset by AWS funding (net $0 to
  Scribl per the SOW). Cost figures below are per-artifact AWS Bedrock runtime cost,
  not engagement cost.
- Everything runs in the customer's preferred region (`us-east-1`) against AWS
  Bedrock. No data leaves AWS.
- The question the POC set out to answer: can generative AI assemble the drawings
  from a game session into a single, shareable keepsake, without redrawing or
  "interpreting" anyone's art? Earlier experiments had taken too much creative
  liberty (turning a stick-figure dog into something no longer theirs).

### What was delivered
- A modular 6-stage Python pipeline (`masking/`) that takes a session folder and
  produces a finished composed artifact. Each stage runs standalone or end-to-end.
- Batch runner across all sessions, with per-stage skip flags for fast iteration.
- Per-run reporting: every run emits `pipeline_report.md` with timing and Bedrock
  token cost per stage.
- Externalized configuration: all prompts and tuning parameters live in one
  `config.json`; supports per-step model selection and model-specific pricing.
- Documentation: `README.md` plus the handover document itself.

### Models used (AWS Bedrock)
- **Claude (Opus 4.8 / Sonnet 4.6)** -- drawing descriptions, background-prompt
  authoring, composition planning, iterative review. Each AI stage's model is
  independently configurable.
- **Stability AI (Stable Image Inpaint)** -- renders the sketch-style background.

### The 6 stages
Two stages are pure image processing (no model); four use Bedrock foundation models.
Per-stage model is set in `config.json`.

| # | Stage | What it does | Engine |
| --- | --- | --- | --- |
| 1 | **Mask** | Strips the white card background and gray border, leaving each drawing on a transparent layer. Records per-card quality metrics (coverage, blank/dense flags). | OpenCV (no model) |
| 2 | **Describe** | Sends each masked drawing + the session prompt to Claude, which returns a one-sentence description of the subject. Calls run in parallel (a session that took ~7 min now completes in under 2 min). | Claude (Sonnet 4.6) |
| 3 | **Generate Background** | Claude writes a constrained, sketch-style prompt; Stability AI renders a clean background. Hard rules keep it minimal, people-free, hand-drawn, never photorealistic. Supports indoor and outdoor scenes. | Claude + Stability AI |
| 4 | **Plan Composition** | Claude views the background and arranges every card -- position, scale, z-order, thematic groupings -- so the scene reads logically. | Claude |
| 5 | **Compose** | Layers the original drawings onto the background per the plan. Large sessions auto-split across multiple smaller artifacts (e.g. a 40-person session into 4 artifacts of 10); `max_drawings_per_image` is configurable. | Pillow (no model) |
| 6 | **Refine** | Claude reviews the composed image against the background and nudges placement; loops until satisfied or the iteration cap is reached (`--refine-iterations`, default 3). | Claude |

**Key design choice:** the participants' drawings are only ever masked and placed,
never sent to an image model for regeneration. Fidelity to the original art is
structurally guaranteed, not just prompted for.

**Per-step model selection:** each AI stage can point at a different model via
`config.json` (e.g. Describe on Sonnet 4.6 for cost/speed, planning/refine on Opus).

### Tuning levers (config.json + CLI, no code changes)
Prompts (`config.json -> prompts`: describe, background-style + negative, placement,
refinement); background style / allowed scene types; per-step `model_id` or
`--model`; canvas size / aspect ratio (`--canvas-width` / `--canvas-height`);
drawings per artifact (`max_drawings_per_image`); refine depth
(`--refine-iterations`); drop shadows (`--shadow`); pricing (`config.json ->
pricing`, model-specific input/output rates); masking thresholds (`mask_pipeline.py`
HSV value/saturation -- rarely tuned).

### Cost and time
- Cost is dominated by the image-heavy AI stages: Describe (one image per card) and
  Refine (two images per iteration). Output tokens are small; input/image tokens
  dominate. Mask and Compose are effectively free (local CPU).
- Example pricing in `config.json`: Claude Opus 4.8 $15.00 / $25.00 per 1M
  input/output tokens; Claude Sonnet 4.6 $3.00 / $15.00 per 1M.
- Representative single sessions: ~1 min, ~$0.12 to ~$0.22 each. A 20-session batch:
  34m 57s total, ~427k input + ~101k output tokens, ~$4.31 total.
- Roughly **$0.12 -- $0.25 per typical session**, higher for larger/busier sessions.
- Cost-control levers: `--refine-iterations` cap with early stop; `--skip-*` flags to
  re-run only changed stages; parallel Describe calls; per-step model routing;
  per-stage reporting to spot the costliest step.

### Running the pipeline (appendix)
- One session: `python masking/run_pipeline.py --session "files/Single Round Games/<uuid> - <prompt>"`
- With options: add `--shadow --refine-iterations 3`
- All sessions: `python masking/run_all_sessions.py`
- Outputs under `masking/output/<session>/`: `compose_output/composite_canvas.png`
  (final artifact), `pipeline_report.md`, and intermediates `descriptions.json`,
  `composition_plan.json`, `background.png`.
- Prerequisites: Python 3.11+, AWS Bedrock access in `us-east-1`, model access
  enabled for the configured Claude and Stability AI models.

### Documented future enhancements (for reference)
Multi-scene backgrounds; a dedicated AI grouping round; per-artifact backgrounds for
large groups; user-provided drawing labels/captions (cited as the cheapest,
highest-impact quality lever); transcript/sentiment integration; smarter "true"
compositional integration; stroke-level data for animation/playback; Scribl-provided
templates; style consistency via seed controls; multi-round handling; a formal
evaluation harness. Recommended next phase in the handover: productionize the
pipeline as a live service (API Gateway + Lambda + S3), add user captions, pilot and
measure, then expand.

---

## Part 2 -- Feature plan: original vs AI-enhanced (our own build)

### Goal and decisions
Show the user's submitted drawing next to an "AI-enhanced" version. Decisions taken
with Rob:

1. **"AI-enhanced" = scene around the art.** The original is preserved pixel-for-pixel
   and composited onto an AI-generated, deliberately simple, hand-drawn background.
   This honors the partner's North Star: never regenerate the art.
2. **Build our own version from the handover.** We do not have the partner's code. We
   have the app repo, this machine, and Claude via the Anthropic API key in `.env`.
   There is **no image-generation model** available (no Bedrock, no Stability). So the
   background is authored by Claude as simple hand-drawn-style **SVG**, then rendered
   and composited. Claude-only.
3. **Enhancement unit is a single drawing** (not the multi-drawing session composite
   the partner built). Their session-composite remains a documented later option.

### Our pipeline (TypeScript, Claude-only)
Adapted from the partner's 6 stages, reduced to what a single-drawing, Claude-only
build needs.

1. **Mask -- ELIMINATED.** The partner needed OpenCV because they were handed flat
   photos of drawings on white cards. We are not. Scribl tracks every stroke as vector
   data (`components/canvas/SkiaCanvas.tsx` holds `Stroke[]` in state), so the lines
   are already separate from any background. We export a transparent, lines-only PNG --
   either by rendering the tracked strokes to an offscreen transparent Skia surface at
   export time, or by ensuring `exportToImage` (`SkiaCanvas.tsx:120-122`,
   `makeImageSnapshot`) omits the paper/card surface. This removes the entire OpenCV
   masking stage structurally, not by tuning thresholds.
2. **Describe -- Claude vision.** Reuse the existing provider seam
   `packages/claude-provider-adapter` `describeImage` (`types.ts:47-59`): base64 PNG +
   prompt context -> one-sentence subject description.
3. **Generate Background -- Claude -> SVG (replaces Stability).** Claude does not do
   image generation, but it reliably emits clean SVG (and simple PNGs). Lean into that:
   Claude `generate` (`types.ts:33-44`) authors a deliberately simple, minimal,
   people-free, hand-drawn-style scene as SVG markup -- a few shapes and lines, not a
   rendered painting -- then we render SVG -> raster at a social canvas size. Carry the
   partner's hard negatives (no photorealism, muted, minimal). The simplicity is a
   feature: it keeps the drawing the most detailed thing on the canvas, matching the
   partner's "background enhances, not distracts" goal.
4. **Plan Composition -- trivial.** Single drawing: center and scale to fit. No model
   call.
5. **Compose.** Composite the original PNG over the background raster (`sharp`);
   optional drop shadow.
6. **Refine -- optional, deferred for the POC.** Claude vision could review the
   composite and return a nudge; cap at 1 iteration if included.

### Where it runs
Enhancement runs server-side, asynchronously, OFF the submit critical path (per the
app's ADR 0010: the provider adapters are server-side only and must stay off the hot
path). Trigger it after `putSubmission` in `backend/lambda/handlers/submit.ts:69`, or
from a dedicated enhance handler / queue. Note the provider adapter is currently only
exercised by tests -- this feature wires it into a handler for the first time. Use the
`direct` / `claude` adapter (Anthropic API key from `.env`); the Bedrock adapter
exists (`packages/claude-provider-adapter/factory.ts`) but needs AWS credentials.

### Integration map (paths relative to the MobileApp code repo)
- **Types:** add `enhancedImageRef?: string` to `ChannelResponse`
  (`packages/shared-types/domain.ts:84-96`); optionally to `SubmitResponse`
  (`packages/shared-types/api.ts`).
- **Schema:** add `enhanced_image_ref text` to the `responses` table
  (`backend/db/schema.sql:64-73`).
- **Generate:** a new backend module (e.g. `backend/lambda/enhance/`) that consumes
  the provider adapter and does the SVG render + compose; triggered async from the
  submit handler (`backend/lambda/handlers/submit.ts:57-69`).
- **Store:** thread the enhanced result through `putSubmission`
  (`backend/lambda/data/postgres-client.ts:131-171`, insert the new column) and
  `listChannelResponses` (`:210-246`, map `enhanced_image_ref` -> `enhancedImageRef`).
- **Display:** in the response detail screen (`app/response/[id].tsx:174-182`), render
  the original `DrawingImage` beside a second one bound to `enhancedImageRef`. A small
  `OriginalVsEnhanced` wrapper around `components/DrawingImage.tsx` fits the existing
  pattern. Handle a "pending" state while the async enhancement is still running.
- **Config:** mirror the partner's externalized config -- describe/background/negative
  prompts, canvas size, refine cap -- so tuning needs no code change.

### Tech recommendation
Build our own TypeScript pipeline from the handover, Claude-only via the Anthropic
API. Claude authors a simple SVG hand-drawn background (no image model available);
`sharp` handles transparent export cleanup and compositing. Rationale:
- **Fits the existing stack.** The backend is TypeScript / AWS Lambda (Node 22); there
  is no Python anywhere. A ported TS pipeline avoids introducing a second language and
  runtime for a POC.
- **Reuses a real seam.** The `claude-provider-adapter` already exposes `describeImage`
  (vision) and `generate` (text/SVG), and the app already depends on the Anthropic
  SDK. No new provider is needed for the POC.
- **Honors the North Star cheaply.** The drawing stays a pixel-perfect PNG; only the
  scene around it is generated. Eliminating the OpenCV mask stage (because we own
  vector strokes) is the single biggest simplification over the partner's design.
- **No new AWS/Bedrock access required.** A real image model (Bedrock Stability, as the
  partner used) is a documented later upgrade, not a POC dependency.

### Dependencies and open questions for Rob
- **Background render lib:** confirm `resvg-js` vs `sharp` for SVG -> raster (both are
  new backend deps).
- **Image model later?** Claude-authored simple SVG is the decided POC path. A richer
  background via a real image model (Bedrock Stability) would need Bedrock access,
  region, and model enablement we do not currently have.
- **Async infrastructure:** inline-after-submit (slower submit) vs a queue / second
  Lambda (e.g. SQS) vs on-demand-at-view-time with caching. Recommendation: async
  queue or on-demand-cached so submit stays fast.
- **Image storage:** today images are stored as full base64 data URIs in a Postgres
  `text` column (`backend/lambda/data/postgres-client.ts`, produced at
  `app/draw.tsx:64`). A second full-resolution enhanced PNG roughly doubles per-row
  size -- recommend moving the enhanced (and ideally the original) image to S3 and
  storing a key/URL. Decision needed.
- **Skia transparent export:** render the tracked `Stroke[]` to an offscreen
  transparent surface, or make `exportToImage` omit the paper background? Either path
  removes the need for an OpenCV mask stage.
- **Refine loop:** include a single Claude vision refine pass in the POC, or defer?
- **Adapter choice:** Anthropic API (`direct`) for the POC vs the Bedrock adapter (which
  would need AWS credentials).

### Not in scope for this session
This is an ingest + planning deliverable. The app feature is not built here, and the
MobileApp code repo is not modified. Promotion of this plan into a tracking story
(`tracking/stories/S-*.md`) is a follow-up for a human, per the repo's story
conventions.
