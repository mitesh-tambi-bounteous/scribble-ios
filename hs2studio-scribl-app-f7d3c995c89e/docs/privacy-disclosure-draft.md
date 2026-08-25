# Privacy & data-disclosure DRAFT (app-store-compliance seam)

**Status: DRAFT for the POC.** Not legal copy. This exists so Apple 1.2 (UGC)
and 5.1.2 (privacy) requirements are designed in from the start, not retrofitted
at submission. The `app-store-compliance` skill is the source; real policy text
and review are a later, pre-launch task.

## Why now (don't design these out)
Scribl is a social, user-generated-content app with AI processing of
submissions. Apple/Google review will gate launch on the items below. The
foundation must **reserve the seams** even though the POC stubs the behaviour.

## Data the app collects / processes (disclose these)
- **Drawings** (and optional text) the user submits — user-generated content.
- **Optional voice** — transcribed **on-device** (ADR-0006); only the transcript
  (never raw audio) would leave the device, and only for moderation. Disclose
  the on-device processing explicitly.
- **AI processing** — submissions are sent to a third-party AI provider (Claude,
  via the provider adapter) for drawing interpretation and moderation. This is a
  **third-party-AI data-sharing disclosure + consent** requirement (Apple
  5.1.2(i)). The provider adapter seam is where this is enforced.
- Account/profile and streak/usage data (auth is stubbed in the POC).

## Apple Guideline 1.2 — UGC requirements (reserve these affordances)
The POC reserves UI affordances as later-story stubs (note only; not built now):
- **Report content** — a report control on each response card.
- **Block users** — a block control on a user/profile.
- **Filter objectionable content** — server-side moderation seam exists via the
  provider adapter (`moderate`); blocked content never reaches a channel wall.
- **Act on reports / contact** — a moderation path and published contact info.

## Apple Guideline 5.1.2 — privacy requirements
- Privacy policy link.
- Consent **before** data collection / AI processing.
- Disclosure of AI/moderation processing of submissions.
- Disclosure that voice is transcribed on-device.

## Auth note
POC auth is **stubbed**, but do **not** design out **Sign in with Apple** — it
is required for social apps offering third-party login (a pre-launch item).

## Data-subject rights (GDPR/CCPA — later)
Data export, account deletion, explicit consent, data minimisation. Out of POC
scope; noted so the data model doesn't preclude them.

## POC checklist (what the foundation must keep true)
- [x] Moderation seam present in the provider adapter (`moderate`).
- [ ] Report/block UI affordances reserved (stub in the relevant story).
- [x] AI/third-party data-sharing disclosure drafted (this doc).
- [ ] Consent gate (later story).
