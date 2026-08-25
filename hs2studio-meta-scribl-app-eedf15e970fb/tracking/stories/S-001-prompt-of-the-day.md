---
id: S-001
title: Prompt-of-the-day
status: done
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [daily-loop]
---

# S-001 -- Prompt-of-the-day

The daily loop starts with a single prompt of the day, surfaced from the thin
backend (seeded JSON via API Gateway + Lambda + DynamoDB). One prompt per day.

## AC

- [x] On open, the app fetches and displays exactly one prompt for the current day
  from the thin backend (no client-side prompt generation).
- [x] The prompt is read through the thin data client over the mock API, not
  hard-coded in the screen component.
- [x] If the daily prompt is unavailable, the screen shows a defined empty/loading
  state rather than a blank or crash.
- [x] The same prompt renders identically on web and on device.

Closeout note (2026-07-27 review): story was moved to Done when the work
merged to MobileApp main; AC boxes ticked retroactively per the board record.
