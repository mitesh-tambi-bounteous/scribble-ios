# ADR 0012: Terraform for production infrastructure (supersedes ADR 0005, pending sign-off)

**Status:** Proposed — pending David Lawton + Jonathan (AWS lead) sign-off; do not treat as
Accepted or begin Terraform authoring/apply against it until they sign off.
**Date:** 2026-07-21
**Deciders:** Jonathan (AWS lead, architecture owner), David Lawton — sign-off pending from
both
**Related:** [../docs/aws-step2-eks-terraform-plan.md](../docs/aws-step2-eks-terraform-plan.md),
[0005](0005-aws-cdk-iac.md) (superseded by this ADR, pending sign-off)

## Context

ADR 0005 chose AWS CDK (TypeScript) because the original PRFAQ named CDK as the
infrastructure target and funded AWS coaching was CDK-specific. Since then, Jonathan's fixed
production architecture has been decided — Amazon EKS compute (one cluster per environment,
growing 3 → 5 clusters as regions launch), Bedrock-fronted Claude, and an Aurora Serverless
v2 + DynamoDB data tier — detailed in `docs/aws-step2-eks-terraform-plan.md`. That plan
follows conventions already proven at `partner-pathfinder/terraform/` and adopted by the
Scribl App Runner POC (`docs/aws-poc-deploy-plan.md`, approved by Jonathan 2026-07-10):
Terraform with an S3 remote backend, S3-native state locking, OIDC-keyless CI. CDK has no
equivalent precedent at this partner scale.

## Decision

We will define production infrastructure as **Terraform** (`hashicorp/aws ~> 6.0`, Terraform
`>= 1.11.0`), organized per `docs/aws-step2-eks-terraform-plan.md` §3-4: a `bootstrap/` root,
a separate `oidc/` root applied once by an admin, per-environment `environments/{dev,stage,prod}`
roots, and one-concern `modules/` (network, eks, eks-platform, ingress-edge, data-aurora,
data-dynamodb, data-cache, data-search, data-media, ai-bedrock, identity, eventing,
observability, analytics, secrets, ecr, app). State lives in a versioned, KMS-encrypted S3
bucket with S3-native locking, one state key per root/region/environment. Because this
mirrors the proven partner-pathfinder and Scribl-POC conventions and unblocks the
OIDC-keyless Bitbucket Pipelines deploy pattern Jonathan's architecture depends on, rather
than requiring a bespoke CDK equivalent with no precedent at this scale.

## Alternatives considered

### Option A: Keep AWS CDK (ADR 0005's original choice)
- Pros: one language (TypeScript) across app and infra; no new tooling for the team to learn.
- Cons: no CDK precedent at partner-pathfinder scale; would require inventing the
  OIDC-keyless CI pattern from scratch instead of reusing a proven one; diverges from the
  EKS/multi-region module conventions already validated for this architecture.
- Why not chosen: the production compute target (multi-region EKS) and its CI pattern are
  already solved in Terraform at partner scale; re-deriving that in CDK adds risk for no
  benefit.

### Option B: Pulumi
- Pros: infra-as-code in TypeScript, closer to Option A's appeal than raw Terraform.
- Cons: no precedent anywhere in the org's AWS estate; would still require inventing the CI/
  state/module conventions from scratch.
- Why not chosen: not evaluated in depth — no adoption precedent to reuse, unlike Terraform.

## Consequences

### Positive
- Reuses proven, working conventions (module layout, state backend, OIDC CI) instead of
  inventing them — directly de-risks Step 3 (writing/applying the Terraform).
- Cloud-agnostic tooling with a large ecosystem and community module support.
- Unblocks the OIDC-keyless Bitbucket Pipelines deploy pattern for multi-region EKS.

### Negative
- Loses the "one language across app and infra" benefit ADR 0005 cited; the team now
  operates a second tool/language (HCL) alongside TypeScript.
- The POC's thin backend slice (API Gateway + Lambda + DynamoDB via CDK, see
  `backend-builder.md`) is unaffected by this ADR and continues to use CDK — this decision
  governs production infrastructure only, not the POC.

### Risks to monitor
- This ADR is **Proposed, not Accepted** — David + Jonathan sign-off is outstanding. Do not
  begin Step 3 (authoring or applying Terraform) until that sign-off lands
  (`docs/aws-step2-eks-terraform-plan.md` §9 D3).
- If sign-off does not land, ADR 0005 (CDK) remains the standing production IaC decision and
  this ADR should be marked Rejected rather than left ambiguously Proposed.

## Related
- [0005](0005-aws-cdk-iac.md) — superseded by this ADR, pending sign-off
- [0004](0004-dynamodb-single-table.md), [0009](0009-claude-provider-abstraction.md)
