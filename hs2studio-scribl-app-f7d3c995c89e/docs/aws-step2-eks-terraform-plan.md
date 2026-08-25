# Scribl — AWS Step 2: EKS Terraform plan (PROPOSAL)

Reviewable Terraform module plan for Scribl's **production** AWS infrastructure, following
Jonathan's decided design (compute = **EKS**, Claude hosting = **Bedrock**, IaC =
**Terraform**). **This document provisions nothing and contains no `.tf`** — it is the
reviewable artifact that routes through `/rplan`. A separate build session (Step 3)
writes and applies the Terraform against this plan.

This is **Step 2** of three: Step 1 (Terraform + Platform-Engineer harness upgrade)
shipped as PR #137; Step 2 is this plan; **Step 3** (build the Terraform) is gated on
sign-off here.

TF conventions **mirror `partner-pathfinder/terraform/`** (Jonathan, AWS lead) and the
Scribl App Runner POC that already adopted them (`docs/aws-poc-deploy-plan.md`, approved
by Jonathan 2026-07-10): S3 remote backend with S3-native `use_lockfile`,
`hashicorp/aws ~> 6.0` / Terraform `>= 1.11.0`, one-concern modules passing ARNs,
`${project}-${environment}-*` naming, provider `default_tags` + per-resource `Component`
tags, least-privilege `aws_iam_policy_document` IAM, Secrets Manager placeholder +
`ignore_changes`, ECR scan-on-push, region-portability via `data.aws_region.current`.
Primary region **us-east-2**, account **662397074844**, admin profile **CraftMind**.

> **This supersedes the POC shape, not the conventions.** `terraform/` today (App Runner
> + S3/CloudFront + Neon) is the throwaway public demo. The production estate below shares
> the POC's backend/naming/tagging/IAM conventions but replaces its compute and data
> modules entirely (App Runner → EKS + ALB + VPC; Neon → Aurora + DynamoDB).

---

## 1. Scope & non-goals

**In scope:** module breakdown, environments + multi-region layout, OIDC-based CI, and
cost-phasing for Jonathan's EKS/Bedrock production architecture — as a proposal.

**Non-goals (this session):**
- No Terraform authored, `init`, `plan`, or `apply`. No AWS writes.
- No application Helm charts / k8s manifests authored (EKS-side app packaging is
  greenfield — flagged, not built).
- Not a redesign. Jonathan's architecture is fixed; we render it into a Terraform module
  plan and surface only genuine open decisions (§9).
- Does not author ADR 0012 or flip 0002/0005 to Superseded — that governance step is a
  prerequisite tracked in §9 D3.

---

## 2. Fixed design constraints (Jonathan's architecture — non-negotiable)

Canonical sources: `meta-scribl-app/docs/context/future-architecture-aws.md`, the
`Scribl_AWS_Architecture_D2C.png` diagram, and `Scribl-D2C-AWS-Estimate-v3.xlsx`
(cost model). The plan below follows these; it does not reopen them.

```
                         Global users (browsers / phones)
                                     │  HTTPS
                    Route 53 (latency routing) → AWS WAF → CloudFront
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼ (us-east-2)           ▼ (eu-west-2, ~m13)      ▼ (ap-southeast-1, ~m25)
      Regional stack            Regional stack            Regional stack
      ALB → EKS cluster         ALB → EKS cluster         ALB → EKS cluster
        │   │   │                 (same shape)              (same shape)
        │   │   └─ EKS → Bedrock → Claude (vision-read/caption · moderation · daily prompt)
        │   └──── Cognito (per region)  ·  EventBridge → SQS → EKS  ·  SNS → Pinpoint
        ▼
   Data tier (per region): Aurora Serverless v2 (relational SoR, 10-ACU HA floor)
                           DynamoDB (high-velocity, on-demand)
                           ElastiCache Redis (always-on)  ·  OpenSearch  ·  S3 (media)
   Observability (per cluster): CloudWatch · Managed Prometheus · Managed Grafana · X-Ray
   Analytics data lake (us-east-2 ONLY, gated ~m13): S3 → Glue → Athena · SageMaker
```

**Fixed facts we execute against:**
- **Compute:** Amazon EKS, **one cluster per environment**; prod runs in every active
  region. Cluster count grows **3 → 5** as regions come online.
- **AI:** EKS → **Bedrock → Claude** (Sonnet vision read/caption ≈ 78% of AI spend;
  Haiku moderation ≈ 22%; Opus daily-prompt-gen < 0.1%). Consistent with the AWS
  co-funding posture.
- **Auth:** Cognito user pools, per region (billed per MAU).
- **Data:** Aurora Serverless v2 + DynamoDB + ElastiCache Redis + OpenSearch + S3 media.
- **Async:** EventBridge → SQS → EKS for the daily prompt-gen job; SNS → Pinpoint for
  push. Media delivery does **not** route through NAT.
- **Observability:** CloudWatch, Amazon Managed Prometheus (AMP), Amazon Managed Grafana
  (AMG), X-Ray.
- **Analytics/ML:** S3 → Glue → Athena + SageMaker, **centralized in us-east-2 only**
  (not replicated regionally), **gated on after Year 1** (default ~month 13).
- **Environments:** dev, stage, prod — three always-on environments.
- **Multi-region rollout:** us-east-2 (Ohio, launch) → eu-west-2 (London, ~m13) →
  ap-southeast-1 (Singapore, ~m25). **dev/stage and the data lake never leave Ohio.**

---

## 3. Repo & state layout

Extends the existing `terraform/` tree (keep bootstrap/backend conventions; replace the
POC compute/data modules). Four Terraform root types, mirroring partner-pathfinder:

```
terraform/
  bootstrap/                 # local state; creates S3 state bucket + writes each env backend.hcl
  oidc/                      # SEPARATE root, applied once by admin; CI deploy role (see §6)
  environments/
    dev/                     # Ohio only
    stage/                   # Ohio only
    prod/                    # composed per region (see §5) — Ohio, then London, then Singapore
  modules/                   # one concern per module (main.tf + variables.tf + outputs.tf)
    network/  eks/  eks-platform/  ingress-edge/
    data-aurora/  data-dynamodb/  data-cache/  data-search/  data-media/
    ai-bedrock/  identity/  eventing/  observability/  analytics/
    secrets/  ecr/  app/
```

**State backend (house default — see §9 D1):** S3 bucket
`scribl-tfstate-<account>-us-east-2`, S3-native locking (`use_lockfile = true`,
Terraform ≥ 1.11), KMS-encrypted, versioned, TLS-only bucket policy, public access
blocked. Each root gets a distinct state key. `bootstrap/` runs with local state and
generates each env's partial `backend.hcl`; the `oidc/` root uses a distinct key
(`oidc/terraform.tfstate`). Per partner-pathfinder, the DynamoDB lock table
(`scribl-tflock`) is **retained but unused** for state stability and removed in a later
deliberate apply once S3-native locking is confirmed as the house default (D1).

**State-key strategy** (see §9 D6):
```
env/dev/terraform.tfstate
env/stage/terraform.tfstate
env/prod/us-east-2/terraform.tfstate
env/prod/eu-west-2/terraform.tfstate         # lands ~m13
env/prod/ap-southeast-1/terraform.tfstate    # lands ~m25
oidc/terraform.tfstate
global/terraform.tfstate                      # Route53 zone, CloudFront, WAF, us-east-1 ACM
```

---

## 4. Module breakdown

One concern per module; modules pass ARNs/names to each other (no implicit coupling).
Scope column: **G** = global/once, **R** = per active region, **E** = per environment.

| Module | Concern | Key AWS resources | Scope | Depends on |
| --- | --- | --- | --- | --- |
| `network` | VPC + subnets + egress | VPC, public/private/intra subnets across ≥3 AZs, NAT GW, IGW, route tables, VPC endpoints (ECR/S3/Secrets/Bedrock); media egress bypasses NAT | E×R | — |
| `eks` | Cluster + data plane | EKS cluster, OIDC provider (IRSA), managed node group(s) or Karpenter (§9 D5), core addons (VPC-CNI, CoreDNS, kube-proxy, EBS-CSI), cluster security groups | E×R | `network` |
| `eks-platform` | In-cluster platform | AWS Load Balancer Controller, ExternalDNS, Karpenter/cluster-autoscaler, metrics-server, ADOT/X-Ray collector (via Helm/IRSA) | E×R | `eks` |
| `ingress-edge` | Global edge | Route 53 hosted zone + records, ACM certs (regional + **us-east-1** for CloudFront), AWS WAF web ACL, CloudFront distribution, latency routing to regional ALBs | G | `eks-platform` (ALB DNS) |
| `data-aurora` | Relational SoR | Aurora Serverless v2 cluster (10-ACU HA floor, prod ACUs scale with DAU), subnet group, SG, param group | E×R | `network`, `secrets` |
| `data-dynamodb` | High-velocity items | DynamoDB tables, **PAY_PER_REQUEST**, explicit attribute + GSI blocks, TTL where applicable, PITR | E×R | — |
| `data-cache` | Cache | ElastiCache Redis (replication group), subnet group, SG | E×R | `network` |
| `data-search` | Search + log analytics | OpenSearch domain, access policy, SG | E×R | `network` |
| `data-media` | Media store | S3 media bucket(s), lifecycle rules, CloudFront OAC read path (no NAT egress) | E×R | — |
| `ai-bedrock` | Claude via Bedrock | IRSA role + least-privilege Bedrock policy (invoke on the pinned inference-profile ARNs), model-access wiring; provider-abstraction toggle Bedrock↔Direct (§9 D4) | E×R | `eks` |
| `identity` | Auth | Cognito user pool(s) + clients, domains, per region | E×R | — |
| `eventing` | Async lane | EventBridge bus + rules/scheduler (daily prompt-gen), SQS queues (+ DLQs), SNS topics, Pinpoint app for push | E×R | `eks` (consumer IRSA) |
| `observability` | Telemetry | CloudWatch log groups + alarms, AMP workspace, AMG workspace, X-Ray; retention/alarm thresholds as **config, not TF literals** | E×R | `eks` |
| `analytics` | Data lake / ML | S3 lake, Glue catalog/jobs, Athena workgroup, SageMaker domain — **us-east-2 only, gate flag `enable_analytics=false` until ~m13** | E (Ohio) | `data-*` |
| `secrets` | Secrets | Secrets Manager containers (DB URL, AI keys, etc.), PLACEHOLDER + `ignore_changes`; seeded out-of-band | E×R | — |
| `ecr` | Images | ECR repos (API, AI service), scan-on-push, lifecycle keep-last-N | G | — |
| `app` | Workload packaging | Helm release(s)/k8s manifests for the Node API + Python AI service, HPA, service accounts (IRSA), ALB Ingress — **greenfield; no charts exist yet** (§9 D-app) | E×R | `eks-platform`, `data-*`, `ai-bedrock`, `identity`, `eventing`, `secrets` |

**Provider note:** `aws ~> 6` (default region from `data.aws_region.current`) plus an
**`aws.us_east_1` alias used only for CloudFront ACM certs and any us-east-1-only edge
concerns** — mirrors partner-pathfinder's alias pattern.

---

## 5. Environments & multi-region layout

- **dev, stage** — Ohio (us-east-2) only; single-region roots. Lower Aurora ACU floor,
  smaller node groups; otherwise the same module set (guards stage drift).
- **prod** — composed **per region**. Each region runs a full regional stack
  (`network` + `eks` + `eks-platform` + `data-*` + `ai-bedrock` + `identity` + `eventing`
  + `observability`). Launch = us-east-2; add eu-west-2 (~m13) and ap-southeast-1 (~m25)
  by standing up a new per-region state + root — **no change to existing regions**.
- **Global / once (`global` state):** Route 53 zone, CloudFront, WAF, us-east-1 ACM —
  fronts all active regional ALBs with latency routing.
- **Ohio-only regardless of region count:** dev, stage, and the `analytics` data lake.
- **Cluster count** grows **3 → 5** across the rollout (dev + stage + prod-Ohio at launch;
  + prod-London, + prod-Singapore later).

Region portability comes from `data.aws_region.current`; documented exceptions =
the us-east-1 ACM alias, `BEDROCK_*` inference-profile IDs, `backend.hcl`, and the
state-bucket name.

---

## 6. OIDC-based CI

The repo is already on **Bitbucket Pipelines** (`bitbucket-pipelines.yml`, CI-only:
typecheck · lint · test · web build). Step 3 adds the **keyless OIDC deploy** plumbing,
mirroring partner-pathfinder's proven pattern (`terraform/oidc/`).

- **Separate `oidc/` root, applied once by an admin** (SSO profile) before any pipeline
  deploy — like `bootstrap/`. Creates the IAM deploy role Pipelines assumes via
  `sts:AssumeRoleWithWebIdentity`; the pipeline never touches this root again.
- **Trust is repo-scoped:** Bitbucket OIDC IdP, `aud` StringEquals (workspace UUID) +
  `sub` StringLike `"{repo-uuid}:*"` — only this repo's pipelines can assume the role.
  Short sessions (`max_session_duration = 3600`).
- **Pipeline flow:** `Validate` (`fmt -check -recursive` + `validate -backend=false`) →
  `Terraform Plan` (assume role, save `tfplan` artifact) → **manual approval gate** →
  `Terraform Apply` (applies the exact saved `tfplan`) → `Publish` (build + push API/AI
  images to ECR, targeted apply of the workload). A **destroy-guard** refuses
  delete/replace unless `ALLOW_DESTROY=true`. Role ARN wired via a repo variable, never
  hardcoded.
- **`DenySelfPrivilegeEscalation`** on the deploy role's own ARN keeps the aud/sub
  scoping tamper-proof from inside a run.
- **Prod hardening (§9, adopt):** split **plan (read-only)** and **apply (write)** into
  two roles, and front apply with a **permissions boundary** on every `scribl-*` role the
  pipeline creates (partner-pathfinder's own prod recommendation).

---

## 7. Cost-phasing

From `Scribl-D2C-AWS-Estimate-v3.xlsx` (list price, us-east-2, no partner discount;
30-month model Oct 2026–Mar 2029). **30-month TCO ≈ $2.45M; AI ≈ 69% of TCO.**

| Phase | Timing | Regions live | Modules added | Run rate |
| --- | --- | --- | --- | --- |
| **P0 Foundation** | pre-launch | — | `bootstrap`, `oidc`, `ecr`, `global` (zone/WAF/CF), `secrets` | negligible |
| **P1 Launch** | M1 | Ohio (dev+stage+prod) | full regional stack ×3 clusters, `app`, `observability` | **≈ $9.1k/mo** |
| **P2 London** | ~M13 | + eu-west-2 prod | new prod-London regional stack; enable `analytics` (Ohio) | rising with DAU |
| **P3 Singapore** | ~M25 | + ap-southeast-1 prod | new prod-Singapore regional stack | rising with DAU |
| **At scale** | M30 | 3 regions, 5M users | (no new modules) | **≈ $182.6k/mo** |

At-scale pillar run rate (M30): AI (Bedrock+Claude) **$132.3k** · Networking $13.8k ·
**Compute/EKS $11.1k** · Security (Cognito/WAF) $10.0k · Database $8.6k · Data lake/ML
$4.5k · Storage $2.4k. The **always-on floor** (3 environments) is the fixed cost even at
low traffic; EKS compute stays ≈ $5–11k/mo across the model. Regional premiums (London,
Singapore vs Ohio) are modest and apply only to each region's traffic share.

**Phasing implication for Terraform:** modules are region-parameterized so P2/P3 are
*additive* (new state + root per region), never edits to live regions. `analytics` ships
behind `enable_analytics` (default off) so it costs nothing until ~M13.

---

## 8. Build order for Step 3

```
bootstrap → oidc → ecr → global(zone/WAF/CF) → network → eks → eks-platform
  → secrets → data-aurora / data-dynamodb / data-cache / data-search / data-media
  → ai-bedrock → identity → eventing → observability → app → analytics(gated)
  → ingress-edge (wire CloudFront/Route53 to the live ALB last)
```
Apply per environment: **dev → stage → prod-Ohio**, then add prod regions as they come
online. Always `plan` before `apply`; renames use `moved {}` blocks to avoid
destroy/recreate.

---

## 9. Open decisions (flagged for Rob — not decided here)

| # | Decision | Recommendation |
| --- | --- | --- |
| **D1** | **TF state-lock convention** — S3-native `use_lockfile` vs a DynamoDB lock table. | **S3-native.** Both the Scribl POC *and* partner-pathfinder already run `use_lockfile = true` (DynamoDB table retained-but-unused). Make S3-native the house default and retire the DynamoDB table in a later deliberate apply. |
| **D2** | **CI platform / OIDC IdP** — Bitbucket Pipelines vs GitHub Actions. | **Bitbucket Pipelines.** The repo is on Bitbucket and CI already ported there; Jonathan's OIDC-keyless pattern is proven on Bitbucket. GitHub Actions would mean a second IdP + host for no benefit. |
| **D3** | **ADR governance** — ADR 0012 (Terraform) authored in PR #137 but **not yet in `decisions/`** (tree has 0001–0011); ADR 0002 (serverless) + 0005 (CDK) still marked *Proposed*, not *Superseded*. | **Prerequisite to Step 3.** Land 0012 into `decisions/`, flip 0002 + 0005 to *Superseded* (with pointers), and get **David + Jonathan sign-off** before the build session starts. |
| **D4** | **Bedrock vs Direct default** — ADR 0009 defaults the provider abstraction to Direct Anthropic API; Jonathan's diagram is Bedrock-fronted. | Terraform provisions **Bedrock IRSA regardless** (it's a config toggle behind the same Messages API). Default **prod → Bedrock** (co-funding posture), **dev → Direct** for speed. "Resolve early, don't block the build." |
| **D5** | **EKS data plane** — managed node groups vs Karpenter vs EKS Auto Mode. | **Karpenter** (or **EKS Auto Mode**). Consumer traffic is diurnal/spiky (the daily-prompt thundering herd) — the very reason ADR 0002 favored serverless. Elastic, fast node scaling matters more than static node groups; revisit if ops prefers Auto Mode's managed simplicity. |
| **D6** | **Multi-region state layout** — per-region-per-env keys vs a single prod state spanning regions. | **Per-region-per-env keys** (`env/prod/<region>/terraform.tfstate`). Blast-radius isolation and additive region rollout; a single spanning state makes London/Singapore adds risky edits to live infra. |
| **D7** | **Datastore split** — ADR 0004 chose **Aurora Serverless v2 (PostgreSQL) as system of record**, with DynamoDB single-table retained as a *forward-scale option, not the default*; Jonathan's diagram shows both Aurora and DynamoDB; the POC used Neon Postgres. | **Aurora is the SoR** (ADR 0004 + Jonathan — largely settled). Provision `data-aurora` at launch. Open sub-question: does `data-dynamodb` land at launch for the genuinely high-velocity paths in Jonathan's diagram, or stay deferred as ADR 0004's forward-scale option? Recommend a **minimal DynamoDB footprint at launch** only where on-demand velocity warrants it. |
| **D-app** | **App packaging** — no Helm charts / k8s manifests exist; the Node API + Python AI service must be containerized and packaged for EKS. | Author minimal Helm charts in Step 3 (Deployment + Service + HPA + IRSA SA + ALB Ingress per service). Reuse the existing `backend/Dockerfile` (already Bedrock-aware) as the API image base; add a Python AI-service image. |

---

## 10. Appendix — conventions & sources

**Naming / tagging:** `scribl-${environment}-*` (region suffix where a resource is
regional); provider `default_tags` = `{Project, Environment, ManagedBy}`; per-resource
`Component` tag. DynamoDB **PAY_PER_REQUEST** with explicit attribute + GSI blocks.

**Providers / versions:** `hashicorp/aws ~> 6.0`, Terraform `>= 1.11.0` (S3-native
locking), `hashicorp/archive ~> 2.0` where a Lambda/bundle is zipped. `aws.us_east_1`
alias for CloudFront ACM only.

**Region / account:** us-east-2 primary; account 662397074844; admin SSO profile
`CraftMind`. Out-of-band setup (secret seeding, Bitbucket OIDC IdP registration,
Bedrock model access) documented in a `docs/manual-installer-steps.md` for Step 3.

**Sources:**
- Jonathan's architecture: `meta-scribl-app/docs/context/future-architecture-aws.md`;
  diagram `s2d/inputs/reference/poc/architecture/Scribl_AWS_Architecture_D2C.png`;
  cost model `.../Scribl-D2C-AWS-Estimate-v3.xlsx`.
- Conventions: `partner-pathfinder/terraform/` (`CLAUDE.md`, `bootstrap/main.tf`,
  `oidc/README.md`) and `docs/aws-poc-deploy-plan.md`.
- ADRs: `decisions/0002-serverless-first-backend.md`,
  `decisions/0004-dynamodb-single-table.md`, `decisions/0005-aws-cdk-iac.md`,
  `decisions/0009-claude-provider-abstraction.md`; ADR 0012 (pending, D3).
