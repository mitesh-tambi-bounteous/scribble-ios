# Scribl inputs -- provenance and audit trail

Relocated source materials for the Scribl project instance (type =
mobile-app-poc). Everything under this directory is verbatim source material:
copied as-is, not transformed. Binary and formatted files (png, pdf, docx, xlsx)
are byte-for-byte preserved.

- **Source (all artifacts):** the scribl engagement's curated project inputs (the
  curated engagement source material plus the planned POC).
- **Date ingested:** 2026-06-30.
- **Why trusted:** these are the engagement source-of-record deliverables for the
  Scribl D2C build.

## Root documents (binary, preserved verbatim)

| File | What it is | Trusted because |
| --- | --- | --- |
| `scribl-d2c-flow.png` | D2C user-flow diagram (binary) | engagement source-of-record deliverable |
| `scribl-d2c-mvp-scope.pdf` | D2C MVP scope / BRD (binary) | engagement source-of-record deliverable |
| `scribl-d2c-mlp-prfaq.docx` | D2C MLP PRFAQ, press release plus FAQ (binary) | engagement source-of-record deliverable |
| `scribl-aws-architecture-d2c.png` | Multi-region production AWS architecture diagram (binary) | engagement source-of-record deliverable |
| `scribl-d2c-aws-estimate-v3.xlsx` | 30-month AWS cost / TCO model (binary) | engagement source-of-record deliverable |
| `scribl-d2c-ui-mockup.html` | D2C full-app UI mockup (Claude Design export, all screens), viewable HTML | design deliverable for the fidelity build, ingested 2026-07-02 |
| `scribl-bounteous-sow-mobile-app-development.pdf` | Executed Scribl <> Bounteous Statement of Work "Mobile App Development" (binary, verbatim, 9 pages). SOW Effective Date 2026-08-13; Docusign Envelope ID 9A10DEA4-2C98-8275-8320-AFEE81F05ABA. | executed legal contract, engagement source-of-record, ingested 2026-08-18 |

## reference/ (narrative and research text)

| File | What it is | Ingested to knowledge/ |
| --- | --- | --- |
| `reference/arc-ideation-readme.md` | Source repo readme | no (provenance only) |
| `reference/client-summary.md` | Client summary / opportunity brief | research/scribl-client-summary.md |
| `reference/engagement-approach.md` | Bounteous engagement approach | research/scribl-engagement-approach.md |
| `reference/technical-implementation-plan.md` | Build sequence, backlog, AI cost model | research/scribl-technical-implementation-plan.md |
| `reference/scribl-team-model.md` | Team model and architecture shape | research/scribl-team-model.md |
| `reference/discussion-topics.md` | Open discussion topics | no (provenance only) |
| `reference/discussions/scribl-approach-digest.md` | Approach call digest | meetings/scribl-approach-discussion.md |
| `reference/discussions/scribl-approach.vtt` | Approach call transcript (verbatim) | meetings/scribl-approach-discussion.md |
| `reference/decisions/0001-0011 + README.md` | The ADRs (0001-0011) | no (preserved as source ADRs) |

All `reference/` text files are preserved here verbatim for provenance; the working
copies live in `knowledge/` as noted.

## reference/poc/ (the planned POC, binary and text)

| File | What it is | Ingested to knowledge/ |
| --- | --- | --- |
| `reference/poc/build-approach.html` | 1-week clickable POC build approach | no (provenance only) |
| `reference/poc/project-dna/CLAUDE.md` | Planned POC harness | no (provenance only) |
| `reference/poc/project-dna/AGENTS.md` | Planned POC harness | no (provenance only) |
| `reference/poc/architecture/README.md` | Production AWS architecture (README plus Mermaid) | research/scribl-poc-aws-architecture.md |
| `reference/poc/architecture/cost-model.md` | TCO model distilled from the workbook | research/scribl-poc-aws-architecture.md |
| `reference/poc/architecture/Scribl_AWS_Architecture_D2C.png` | Canonical architecture diagram (binary) | no (binary, preserved verbatim) |
| `reference/poc/architecture/Scribl-D2C-AWS-Estimate-v3.xlsx` | 30-month TCO workbook, source of truth (binary) | no (binary, preserved verbatim) |

The canonical architecture is the production architecture under `reference/poc/`.

## Note on prose-lint

Everything under `inputs/` is verbatim source material, not authored Playbook
prose, so it is exempt from the repo prose-lint (some reference files contain
em-dashes and unicode from their original authoring). Authored docs elsewhere in
the repo stay lint-clean.
