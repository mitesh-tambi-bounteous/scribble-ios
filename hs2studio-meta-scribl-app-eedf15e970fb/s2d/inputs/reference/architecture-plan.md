# Architecture plan

The original engagement kept a single system-architecture plan (mobile, AWS,
Claude, data, and security, with an ADR index, risks, and open questions) as a
companion to the [technical implementation plan](technical-implementation-plan.md).
In this project brain that material is split across the pages below; the ADRs
that reference "architecture-plan section N" map to the same topics here.

## Where the architecture plan content now lives

- [POC architecture](poc/architecture/README.md) -- the production AWS
  architecture writeup and the Mermaid mirror of the canonical diagram.
- [Cost model](poc/architecture/cost-model.md) -- the 30-month TCO distilled
  from the estimate workbook.
- [Architecture decisions](decisions/) -- the ADRs (0001 through 0011) that back
  the architecture: React Native primary, serverless-first backend, AI pipeline
  as a separate service, data layer, IaC, drawing canvas, submit-to-unlock,
  analytics, provider abstraction, async AI pipeline, and model tiering.
- [Technical implementation plan](technical-implementation-plan.md) -- the build
  sequence, streams, API sketch, and AI cost model that turn the architecture
  into a delivery plan.

For open architecture questions awaiting alignment, see
[discussion topics](discussion-topics.md).
