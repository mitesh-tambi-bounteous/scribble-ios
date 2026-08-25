# ADR 0001: React Native primary, native modules only where required

**Status:** Proposed
**Date:** 2026-06-10
**Deciders:** David Lawton, Rob Forshier II (confirm with Matt Kaplan in Phase 0)
**Related:** [../architecture-plan.md](../architecture-plan.md) §4, [../scribl-team-model.md](../scribl-team-model.md)

## Context

The PRFAQ names the mobile stack as "iOS (Swift) + Android (Kotlin), React Native shared component layer." That phrasing is ambiguous: it can mean two native shells with a shared RN layer, or a single RN codebase with native modules where needed. The two readings imply very different teams and timelines.

The constraints are hard: ~5.0 FTE, a 14-week clock, public launch September 15, 2026, both platforms at launch. The team model assumes a single Mobile Engineer with React Native experience covering both platforms without platform specialization.

## Decision

We will build the app as a **single React Native (TypeScript) codebase**, writing native modules only where the platform genuinely requires them: the drawing canvas, secure token storage, push registration, and on-device speech-to-text. Because a single cross-platform codebase is the only configuration that ships both platforms by September 15 at 5.0 FTE.

## Alternatives considered

### Option A: Native-first (Swift + Kotlin) with an RN shared component layer
- Pros: highest per-platform fidelity; literal reading of the PRFAQ.
- Cons: needs dedicated iOS and Android specialists we are not staffing; roughly doubles UI build effort.
- Why not chosen: incompatible with the lean team and the September 15 date.

### Option B: A different cross-platform stack (Flutter)
- Pros: strong canvas performance, single codebase.
- Cons: departs from both source docs; Claude Design and the team's React skills are RN-aligned; no Anthropic/AWS reference value in the deviation.
- Why not chosen: no advantage that outweighs leaving the stated stack.

## Consequences

### Positive
- One codebase, one test surface, one set of feature engineers.
- Claude Design and React tooling map directly to the build.

### Negative
- Native-module work (canvas especially) is the riskiest code and lives outside the shared layer.

### Risks to monitor
- If React Native Skia cannot meet drawing-canvas responsiveness on low-end Android, a native canvas module is required, which triggers a second mobile engineer with native depth (see [0006](0006-drawing-canvas-skia.md)).

## Related
- [0002](0002-serverless-first-backend.md), [0006](0006-drawing-canvas-skia.md)
