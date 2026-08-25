# Definition of Ready

The Definition of Ready (DoR) is the written criteria that ALL work in the
product backlog must meet before it is pulled into a sprint. The team agrees the
DoR during team chartering, and it applies to both stories and tasks. This is a
starting point -- tune it to how scribl actually works.

## A work item is ready when

- [ ] It has been prioritized against the rest of the product backlog.
- [ ] All outstanding requirements questions are answered.
- [ ] The team understands the business value.
- [ ] If it is a user story, the user is specified and it is written in the form:
      "As a (user type), I want to (do something), so that (business value)."
- [ ] There is an outline of the technical solution (API notes, a data-flow
      sketch, architecture guidance, or the relevant ADR).
- [ ] The team has estimated it.
- [ ] It is feasible to complete within a single sprint at most.
- [ ] It has acceptance criteria. Where applicable, they are written in the
      Given / When / Then (Gherkin) format.
- [ ] It has UX and visual design attached where applicable (the Figma
      spec-of-record).
- [ ] All related dependencies are met and tested before the sprint begins.
- [ ] If copy is required to deliver the item, it is written and in the ticket.
- [ ] Any configuration or environment setup required to deliver it is complete.

## Spikes

If the technical solution is new to the team or not obvious, create a spike as a
separate item so the team can investigate first. The spike's output should be
what makes the resulting work item ready.

Grow this: add or drop criteria as the team learns what "ready" really means here.

_Source: Bounteous Agile Delivery Confluence (space PD). Reconciled against Definitions of Done & Ready (id 46235785); the criteria above already cover the source list, adapted to scribl. Recreated 2026-07-10._
