---
name: app-store-compliance
description: Use when designing UGC, AI features, social channels, or onboarding/privacy flows; builds in Apple and Google store requirements for UGC, AI, social apps (Apple 1.2 UGC, 5.1.2 privacy) before launch.
metadata:
  type: skill
---

# app-store-compliance

scribl is a social, AI-assisted, user-generated-content app. Apple and Google
reject UGC and social apps that lack the required safety and privacy controls.
Design those controls in from the start; do not retrofit at submission time.

Traces to the app-store requirements for UGC, AI, and social apps: Apple
Guideline 1.2 (UGC safety) and 5.1.2 (privacy / data collection). Scopes to the
POC slice (voice STUBBED, auth STUBBED), so these are design hooks the POC must
not foreclose, not full implementations.

## What this skill enforces

Apple 1.2 (UGC) requires, for any app with user-generated content:

1. A method to filter objectionable content. scribl has this server-side
   (Haiku moderation off SQS, ADR 0010/0011); ensure the moderation seam exists
   even if sampled in the POC.
2. A mechanism for users to flag/report objectionable content.
3. A mechanism for users to block abusive users.
4. Published contact info so users can reach the developer.
5. Acting on reports and removing offending content / ejecting users.

Apple 5.1.2 (privacy) requires:

6. A clear privacy policy and disclosure of what data is collected and why.
7. Consent before collecting personal data; data minimization.
8. AI/content moderation disclosure: tell users their submissions are processed
   by AI (drawing interpretation, moderation) and audio is on-device unless
   shared (ADR 0006).

## Concrete steps for the POC slice

- Reserve UI affordances now: a report control on a response and a block
  control on a user, even if wired to a stub in the POC. Do not ship a feed
  with no path to report.
- Keep the moderation seam real (provider adapter `moderate`), so 1.2's filter
  requirement is structurally present, not invented later.
- Draft the data-collection disclosure: what a submission contains (drawing
  image, optional transcript), that AI processes it, and that voice is
  on-device. Note that POC voice is a non-functional stub.
- Note Sign in with Apple is mandatory once any third-party sign-in is offered
  (production via Cognito; POC auth is stubbed, so just do not design it out).

## Test shape

- Affordance presence: assert the response UI exposes a report path and the
  user UI exposes a block path (stubbed actions acceptable in POC).
- Moderation seam present: assert the `moderate` operation exists on the
  provider adapter and is invoked on the submission pipeline.

## Done when

The POC design includes report and block affordances, keeps a real moderation
seam, carries a drafted data/AI disclosure covering submissions and on-device
voice, and does not foreclose Sign in with Apple. No app-store requirement is
left to retrofit at submission.
