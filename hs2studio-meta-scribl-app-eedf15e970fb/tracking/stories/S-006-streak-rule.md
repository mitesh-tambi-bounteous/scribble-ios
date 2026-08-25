---
id: S-006
title: Streak rule
status: done
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [daily-loop]
---

# S-006 -- Streak rule

The habit loop: a streak counter that increments on a same-day submit and resets
when a day is missed, per the daily-loop rule.

## AC

- [x] Submitting on a new day increments the streak by exactly one.
- [x] A second submit on the same day does not increment the streak again.
- [x] Missing a day (no submit) resets the streak to zero (or to one on the next
  submit), per the defined rule.
- [x] The current streak value is displayed and matches the underlying state.

Closeout note (2026-07-27 review): story was moved to Done when the work
merged to MobileApp main; AC boxes ticked retroactively per the board record.
