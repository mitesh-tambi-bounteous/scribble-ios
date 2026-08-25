# Definition of Done

The Definition of Done (DoD) is the written criteria that ALL project work must
meet before it is considered done. The team agrees the DoD during team
chartering. This is a starting point -- tune it to how scribl actually ships.

## A work item is done when

- [ ] It has met all its acceptance criteria.
- [ ] It has passed QA.
- [ ] It is approved by the product owner.
- [ ] It works across the supported set of browsers (scribl ships web via Expo
      export).
- [ ] It works on the supported set of mobile devices (iOS and Android).

Teams often keep a per-competency DoD as well, where it helps. Starting points:

## Experience design

- [ ] Wireframes, visual designs, and any new or enhanced components are in the
      Figma spec-of-record.
- [ ] On completion, assets are exported where appropriate (images .png / .jpg /
      .gif, icons .svg, logos, video).
- [ ] Component documentation is provided.
- [ ] Designs are communicated to the development team.

## Development

- [ ] The developer has reviewed every acceptance criterion and validated the
      work meets it.
- [ ] Code review is done.
- [ ] Unit tests are written where needed.
- [ ] All existing tests pass.
- [ ] Testing instructions are added to the ticket.

## Quality assurance

- [ ] QA has tested it and validated it meets the acceptance criteria.
- [ ] QA has validated it across the supported browsers.
- [ ] QA has validated it meets the UI expectations from the completed designs.
- [ ] The product owner has approved the work where applicable.
- [ ] It has been merged to the main branch.

Grow this: add or drop criteria as the team learns what "done" really means here.

_Source: Bounteous Agile Delivery Confluence (space PD). Reconciled against Definitions of Done & Ready (id 46235785); the per-competency criteria above already cover the source list, adapted to scribl (web via Expo export, merge to main). Recreated 2026-07-10._
