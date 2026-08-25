# Scribl (MobileApp) — AWS POC deploy plan

Reviewable Terraform + Dockerfile skeleton to stand up the Scribl POC publicly (multiple people log
in and drive it on demo day). **This PR provisions nothing** — no `terraform apply`, no image build,
no AWS writes. It is the reviewable artifact; a separate build+deploy session executes the ordered
steps below. Seeds toward — but is deliberately **not** — the full S2D production architecture
(EKS + Bedrock + multi-region).

TF conventions **mirror `partner-pathfinder/terraform/`** (Jonathan, AWS lead): S3 remote backend
with S3-native `use_lockfile`, `hashicorp/aws ~> 6.0`, `${project}-${environment}-*` naming, provider
`default_tags` + per-resource `Component` tags, region **us-east-2**, profile **CraftMind**, account
**662397074844**. ✅ Approach approved by Jonathan (2026-07-10).

## Decisions
- **API compute → AWS App Runner** (container from ECR): automatic public HTTPS URL, autoscale-to-low,
  native Secrets Manager, no VPC/ALB/cluster. Least ops for a POC; reaches Neon over the public
  internet. Chosen over PP's Fargate (needs ALB + ACM for HTTPS) and Lambda (incomplete route wiring).
- **Web hosting → S3 + CloudFront** (OAC to a private bucket): clean public HTTPS URL. HTTPS is
  required — an HTTPS page can't call an HTTP API (mixed content), and logins need TLS.
- **Database → Neon** (external managed Postgres). No AWS DB infra; the API's `DATABASE_URL` points
  at Neon.

## Target architecture
```
                    Demo users (browsers / phones)
                              │  HTTPS
              ┌───────────────┴───────────────┐
              ▼                                ▼
   CloudFront distribution            App Runner service
   (OAC → private S3 bucket)          (container from ECR :tag)
   serves Expo static `dist/`         runs backend/local-server.ts
              │                        env: SCRIBL_DATA_MODE=postgres
              ▼                        secrets: DATABASE_URL (+AI keys)
   S3 bucket  scribl-poc-web-…                 │ HTTPS (public internet)
   (private, versioned, OAC-only)              ▼
                                        Neon Postgres (external, managed)
```
The web bundle bakes `EXPO_PUBLIC_API_BASE_URL` = the App Runner URL **at build time**, so deploy
order is **API first, then build+push web**.

## Terraform layout (this PR)
- `terraform/bootstrap/` — S3 state bucket `scribl-poc-tfstate-<account>-us-east-2`, retained lock
  table, generates `environments/dev/backend.hcl` (`use_lockfile = true`). Dev-only.
- `terraform/modules/ecr/` — ECR repo `scribl-poc/api` (scan-on-push, keep-last-10).
- `terraform/modules/secrets/` — 3 Secrets Manager containers (`database-url`, `openai-api-key`,
  `anthropic-api-key`), PLACEHOLDER + `ignore_changes`; seeded out-of-band.
- `terraform/modules/api/` — App Runner service on port 8787, `/health` check, access role (ECR pull)
  + least-privilege instance role (`GetSecretValue` on the 3 ARNs only). Output `service_url`.
- `terraform/modules/web/` — private S3 bucket + CloudFront (OAC), `index.html` root, 403/404 →
  `/index.html`. Objects uploaded out-of-band.
- `terraform/environments/dev/` — providers, `backend "s3" {}`, module wiring, `dev.tfvars`, outputs.
- `backend/Dockerfile` (+ repo-root `.dockerignore`) — ts-node image; **build context = repo root**
  (backend imports `packages/`): `docker build --platform=linux/amd64 -f backend/Dockerfile -t scribl-api .`

## Ordered deploy steps (the follow-on session executes these)
1. `terraform -chdir=terraform/bootstrap init && … apply` → writes `backend.hcl`.
2. `terraform -chdir=terraform/environments/dev init -backend-config=backend.hcl`.
3. `… apply -target=module.ecr -target=module.secrets` (create ECR + secret containers first).
4. Seed secrets out-of-band: `aws secretsmanager put-secret-value` for `database-url` (Neon),
   `openai-api-key`, `anthropic-api-key`.
5. Build + push API image (mirror PP `scripts/publish.sh`), `linux/amd64`.
6. `… apply -var="api_image_tag=<tag>"` (creates App Runner) → capture `service_url`.
7. From `backend/`, with `DATABASE_URL` → Neon: `npm run db:bootstrap` then `npm run db:prompts`
   (seed at least today's + demo-day prompt).
8. Build web: `EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=<service_url> npx setup-skia-web public && npx expo export -p web`.
9. `… apply` (S3 + CloudFront), then `aws s3 sync dist/ s3://<bucket>/ --delete` + CloudFront invalidation.
10. Smoke test: open the CloudFront URL, log in, run prompt → draw → submit → wall loop.

## Secrets
- `DATABASE_URL` (Neon) — required.
- `OPENAI_API_KEY` **and** `ANTHROPIC_API_KEY` — both available; seed both to run live AI at the demo
  (`STT_PROVIDER=cloud`, `IMAGE_PROVIDER=openai`, `CLAUDE_PROVIDER=direct`) rather than the `stub`
  defaults.
- No secret values in TF or git — placeholder + `ignore_changes`, seeded via `put-secret-value`.

## Mirrors vs. diverges from partner-pathfinder
**Mirrors:** S3 backend + `use_lockfile`, `aws ~> 6.0` / `>= 1.11.0`, `${project}-${env}-*` naming,
`default_tags` + `Component` tags, one-concern modules passing ARNs, Secrets Manager placeholder +
`ignore_changes`, least-privilege `aws_iam_policy_document` IAM, ECR scan-on-push, image build via
`docker buildx` → ECR.

**Diverges (flagged for review):**
- **App Runner instead of Fargate+ECR** — no ALB/VPC/cluster for a public POC. If the estate should
  stay on Fargate for consistency, we'd add ALB + ACM cert + minimal VPC.
- **No VPC / `network` module** — App Runner is public-egress managed and Neon is external; the API
  reaches Neon over the public internet.
- **No `us-east-1` alias** (no Partner Central), **dev-only** (no prod mirror yet).
- **CloudFront OAC + private S3** for the web (PP has no static-web surface).

## Open questions
- **Custom domain?** Assumed no — use default `*.cloudfront.net` / `*.awsapprunner.com`. Adding one
  needs Route 53 + ACM (us-east-1 cert for CloudFront).
- **Cost (POC, low traffic):** ~< $40/mo (App Runner min instance + CloudFront/S3/ECR/Secrets);
  Neon billed separately. Acceptable, or scale App Runner to zero (adds cold-start at the demo)?
- **`environments/prod`?** Dev only for now — add a prod mirror or defer?

## Verification done in this PR (no AWS touched)
- `terraform fmt -check -recursive terraform` → clean.
- `terraform -chdir=terraform/environments/dev validate` (after `init -backend=false`) → valid.
- Dockerfile reviewed; `npm ci` runs before `NODE_ENV=production` so `ts-node`/`typescript` (runtime
  deps) are installed.
