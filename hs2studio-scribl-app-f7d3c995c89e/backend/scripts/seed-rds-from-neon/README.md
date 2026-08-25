# Seed private RDS from current Neon data

One-off, **reproducible** job that loads Rob's current Neon Postgres data into the
private AWS RDS instance (`scribl-poc-dev-db`) so the live App Runner API serves
real content. RDS stays **private** throughout — no SG / subnet / public-access
change is made.

## Why ECS Fargate (not CodeBuild)

The brief's first choice was an in-VPC **CodeBuild** job. It doesn't work here:
the dev VPC (`vpc-026cbf2dfeaa5d77d`) has **only public / internet-gateway
subnets — no NAT gateway and no VPC endpoints**. A CodeBuild VPC job's ENI gets
no public IP, so from these subnets it can reach RDS (in-VPC) but **not** Neon
(public internet).

A one-off **ECS Fargate task launched with `assignPublicIp=ENABLED`** gets a
routable public IP, so a single job reaches all three at once:

| Target          | Path                                              |
| --------------- | ------------------------------------------------- |
| Neon (source)   | public internet via the internet gateway          |
| Secrets Manager | public AWS API via the internet gateway           |
| RDS (target)    | in-VPC, SG `scribl-poc-dev-apprunner` trusted by the DB SG |

The brief explicitly allows Fargate as the fallback when the in-VPC options
don't fit; this VPC's topology makes it the correct choice.

Source is Postgres 18.x (Neon), target is 16.x (RDS), so the job runs the
**`postgres:18` image** (`public.ecr.aws/docker/library/postgres:18`) for a
matched-version `pg_dump` and a forward `pg_restore`.

## Files

- `seed.sh` — runs inside the container: preflight → `pg_dump` (Neon, `-Fc
  --no-owner --no-acl`) → `pg_restore --clean --if-exists --no-owner` (RDS) →
  idempotent challenge-timer migration → per-table row-count verification
  (Neon vs RDS; enumerated dynamically from `pg_tables`).
- `run.sh` — idempotent orchestrator: puts the Neon URL into Secrets Manager
  (never printed), creates the log group / exec role / cluster, registers the
  task def (injecting `seed.sh` as the container command), runs the task,
  waits, and prints the container exit code + full logs.

## Run

```bash
cp /path/to/scribl-app/.env <repo-root>/.env      # Neon DATABASE_URL, gitignored
AWS_PROFILE=CraftMind AWS_REGION=us-east-2 bash backend/scripts/seed-rds-from-neon/run.sh
```

## One-off AWS resources created (region us-east-2, account 662397074844)

| Kind                 | Name                                         |
| -------------------- | -------------------------------------------- |
| Secrets Manager      | `scribl-poc-dev/neon-source-url`             |
| CloudWatch log group | `/ecs/scribl-seed-neon`                      |
| IAM role             | `scribl-seed-neon-exec`                      |
| ECS cluster          | `scribl-seed-neon`                           |
| ECS task definition  | `scribl-seed-neon`                           |

Cleanup (RDS untouched; `database-url` secret left intact):

```bash
AWS_PROFILE=CraftMind AWS_REGION=us-east-2 bash backend/scripts/seed-rds-from-neon/run.sh --cleanup
```

## Result (2026-07-24 run)

Dump: pg18 client, 13.7 MB custom-format archive from Neon (PG 18.4) → restored
into RDS (PG 16.13). The only restore error was the expected `SET
transaction_timeout = 0` (an 18→16 GUC the older server doesn't know — non-fatal,
data unaffected); the challenge-timer migration then applied idempotently.

Row counts matched on every table:

| table | Neon | RDS | | table | Neon | RDS |
| --- | --- | --- | --- | --- | --- | --- |
| challenge_entries | 1 | 1 | | prompts | 16 | 16 |
| challenge_ratings | 0 | 0 | | reactions | 4 | 4 |
| challenges | 1 | 1 | | responses | 9 | 9 |
| channel_members | 7 | 7 | | submissions | 8 | 8 |
| channels | 5 | 5 | | users | 2 | 2 |
| comments | 2 | 2 | | families | 0 | 0 |

Live API (verified): `https://jzj465kitt.us-east-2.awsapprunner.com`

## libpq sslmode note

The RDS secret's URL uses `sslmode=no-verify` (accepted by the app's Node `pg`
client, rejected by libpq). `seed.sh` normalizes it to the libpq equivalent
`sslmode=require` (SSL on, cert not verified) at runtime only — the stored secret
is not modified.
