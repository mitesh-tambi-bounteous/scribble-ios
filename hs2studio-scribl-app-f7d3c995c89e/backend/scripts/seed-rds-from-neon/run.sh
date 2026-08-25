#!/usr/bin/env bash
# run.sh — orchestrate a one-off ECS Fargate task that loads current Neon data
# into the private AWS RDS instance (see seed.sh for the in-container logic and
# the Fargate-vs-CodeBuild rationale).
#
# Idempotent: every resource is create-or-reuse, so re-running is safe. Reads the
# Neon DATABASE_URL from a repo-root .env (gitignored) and stores it in Secrets
# Manager for injection — the value is never echoed. RDS stays PRIVATE; no SG,
# subnet, or public-access change is made.
#
# Usage:  AWS_PROFILE=CraftMind AWS_REGION=us-east-2 bash run.sh
# Cleanup: bash run.sh --cleanup   (deletes the one-off resources it created)
set -uo pipefail

# ── Discovered dev-estate constants (us-east-2 / account 662397074844) ──────────
: "${AWS_REGION:=us-east-2}"; export AWS_REGION
readonly RDS_SECRET_NAME="scribl-poc-dev/database-url"
readonly NEON_SECRET_NAME="scribl-poc-dev/neon-source-url"
readonly SUBNETS="subnet-0590733ec582a288b,subnet-0a6d860b0f0cce1c0"   # the only (public/IGW) subnets in the VPC
readonly SG="sg-0174574aaa4e1f964"                                     # scribl-poc-dev-apprunner, trusted by the DB SG
readonly CLUSTER="scribl-seed-neon"
readonly TASK_FAMILY="scribl-seed-neon"
readonly EXEC_ROLE="scribl-seed-neon-exec"
readonly LOG_GROUP="/ecs/scribl-seed-neon"
readonly IMAGE="public.ecr.aws/docker/library/postgres:18"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../../../.env}"

die() { echo "FATAL: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
have aws || die "aws cli not found"; have jq || die "jq not found"

# ── Cleanup path ────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--cleanup" ]; then
  echo "Cleaning up one-off resources..."
  aws ecs delete-cluster --cluster "$CLUSTER" 2>/dev/null && echo "  deleted cluster" || true
  aws logs delete-log-group --log-group-name "$LOG_GROUP" 2>/dev/null && echo "  deleted log group" || true
  aws iam delete-role-policy --role-name "$EXEC_ROLE" --policy-name read-seed-secrets 2>/dev/null || true
  aws iam detach-role-policy --role-name "$EXEC_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true
  aws iam delete-role --role-name "$EXEC_ROLE" 2>/dev/null && echo "  deleted exec role" || true
  aws secretsmanager delete-secret --secret-id "$NEON_SECRET_NAME" \
    --force-delete-without-recovery 2>/dev/null && echo "  deleted neon source secret" || true
  echo "Done. (RDS untouched; scribl-poc-dev/database-url left intact.)"
  exit 0
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)" || die "no AWS creds"
echo "account=$ACCOUNT region=$AWS_REGION"

# ── 1. Neon source URL → Secrets Manager (value never printed) ──────────────────
# Extract ONLY DATABASE_URL — do NOT `source` the whole .env: it may set
# AWS_REGION/AWS_DEFAULT_REGION and silently redirect every call to the wrong
# region. Strip an optional `export ` prefix and surrounding quotes.
[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE (cp scribl-app/.env there)"
NEON_URL_VALUE="$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$ENV_FILE" \
  | head -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')"
[ -n "$NEON_URL_VALUE" ] || die "DATABASE_URL (Neon) not found in $ENV_FILE"
# Capture the ARN from the mutating call (strongly consistent — describe/list lag
# right after create-secret and would 404 on a just-created secret).
if aws secretsmanager describe-secret --secret-id "$NEON_SECRET_NAME" >/dev/null 2>&1; then
  NEON_SECRET_ARN="$(aws secretsmanager put-secret-value --secret-id "$NEON_SECRET_NAME" \
    --secret-string "$NEON_URL_VALUE" --query ARN --output text)" || die "put neon secret failed"
  echo "neon source secret: updated"
else
  NEON_SECRET_ARN="$(aws secretsmanager create-secret --name "$NEON_SECRET_NAME" \
    --description "One-off: Neon source URL for the RDS seed job. Safe to delete after." \
    --secret-string "$NEON_URL_VALUE" --query ARN --output text)" || die "create neon secret failed"
  echo "neon source secret: created"
fi
unset NEON_URL_VALUE
RDS_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$RDS_SECRET_NAME" --query ARN --output text)"
[ -n "$RDS_SECRET_ARN" ] && [ "$RDS_SECRET_ARN" != "None" ] || die "RDS secret not found in $AWS_REGION"
[ -n "$NEON_SECRET_ARN" ] && [ "$NEON_SECRET_ARN" != "None" ] || die "neon secret ARN missing"

# ── 2. CloudWatch log group ─────────────────────────────────────────────────────
aws logs create-log-group --log-group-name "$LOG_GROUP" 2>/dev/null \
  && echo "log group: created" || echo "log group: exists"

# ── 3. Task execution role ──────────────────────────────────────────────────────
if ! aws iam get-role --role-name "$EXEC_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$EXEC_ROLE" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null || die "create role failed"
  aws iam attach-role-policy --role-name "$EXEC_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || die "attach policy failed"
  echo "exec role: created"
else
  echo "exec role: exists"
fi
# Inline policy: read exactly the two secrets this job injects.
aws iam put-role-policy --role-name "$EXEC_ROLE" --policy-name read-seed-secrets \
  --policy-document "$(jq -n --arg a "$RDS_SECRET_ARN" --arg b "$NEON_SECRET_ARN" \
    '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:"secretsmanager:GetSecretValue",Resource:[$a,$b]}]}')" \
  || die "put role policy failed"
EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${EXEC_ROLE}"

# ── 4. ECS cluster ──────────────────────────────────────────────────────────────
aws ecs create-cluster --cluster-name "$CLUSTER" >/dev/null 2>&1 \
  && echo "cluster: created" || echo "cluster: exists"

# ── 5. Register task definition (seed.sh injected as the container command) ─────
TASKDEF="$(jq -n \
  --arg family "$TASK_FAMILY" --arg execRole "$EXEC_ROLE_ARN" --arg image "$IMAGE" \
  --arg lg "$LOG_GROUP" --arg region "$AWS_REGION" \
  --arg neonArn "$NEON_SECRET_ARN" --arg rdsArn "$RDS_SECRET_ARN" \
  --rawfile cmd "$SCRIPT_DIR/seed.sh" \
  '{family:$family, requiresCompatibilities:["FARGATE"], networkMode:"awsvpc",
    cpu:"512", memory:"2048", executionRoleArn:$execRole,
    containerDefinitions:[{
      name:"seed", image:$image, essential:true,
      entryPoint:["bash","-c"], command:[$cmd],
      secrets:[{name:"NEON_URL",valueFrom:$neonArn},{name:"RDS_URL",valueFrom:$rdsArn}],
      logConfiguration:{logDriver:"awslogs",options:{
        "awslogs-group":$lg,"awslogs-region":$region,"awslogs-stream-prefix":"seed"}}
    }]}')"
TD_ARN="$(aws ecs register-task-definition --cli-input-json "$TASKDEF" \
  --query 'taskDefinition.taskDefinitionArn' --output text)" || die "register task def failed"
echo "task def: $TD_ARN"

# ── 6. Run the task (public IP so it reaches Neon + Secrets Manager + RDS) ──────
NETCFG="awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SG}],assignPublicIp=ENABLED}"
# Bounded retry: a just-created execution role can 404/assume-fail until IAM
# propagates (typically < 30s).
TASK_ARN=""
for attempt in 1 2 3 4 5 6; do
  TASK_ARN="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE \
    --task-definition "$TD_ARN" --network-configuration "$NETCFG" \
    --query 'tasks[0].taskArn' --output text 2>/dev/null)"
  [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ] && break
  echo "run-task attempt $attempt not ready (IAM propagation?); retrying in 10s..."
  TASK_ARN=""; sleep 10
done
[ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ] || die "run-task failed after retries"
TASK_ID="${TASK_ARN##*/}"
echo "task: $TASK_ARN"
echo "waiting for task to stop (up to ~10 min)..."
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN" || die "wait failed"

# ── 7. Report exit code + logs ──────────────────────────────────────────────────
EXIT_CODE="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)"
STOP_REASON="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].stoppedReason' --output text)"
echo "==== TASK LOGS ===="
aws logs get-log-events --log-group-name "$LOG_GROUP" \
  --log-stream-name "seed/seed/${TASK_ID}" --limit 1000 \
  --query 'events[].message' --output text 2>/dev/null || echo "(no logs)"
echo "==== END LOGS ===="
echo "container exitCode=$EXIT_CODE stoppedReason=$STOP_REASON"
[ "$EXIT_CODE" = "0" ] || die "seed task failed (exitCode=$EXIT_CODE)"
echo "SEED TASK SUCCEEDED"
