#!/usr/bin/env bash
# seed.sh — runs INSIDE a one-off ECS Fargate task (image: postgres:18) to load
# the current Neon data into the private AWS RDS instance.
#
# Why Fargate (not CodeBuild): the dev VPC has only public/IGW subnets — no NAT
# and no VPC endpoints. A CodeBuild VPC job gets no public IP, so it can reach
# RDS (in-VPC) but NOT Neon (public internet). A Fargate task launched with
# assignPublicIp=ENABLED gets a routable public IP, so a single job reaches Neon
# (via IGW), Secrets Manager (public API), AND private RDS (in-VPC, SG-trusted).
#
# Inputs (injected by the ECS task definition `secrets`, never printed):
#   NEON_URL — source Postgres 18.x connection string (Neon)
#   RDS_URL  — target Postgres 16.x connection string (private RDS)
#
# Source server is PG 18.x, target is PG 16.x, so both dump and restore use the
# pg18 client shipped in the postgres:18 image. Row counts are the source of
# truth for success — stray "SET transaction_timeout" style notices from an 18
# client talking to a 16 server are logged but non-fatal.
set -uo pipefail

fail() { echo "FATAL: $*" >&2; exit 1; }

[ -n "${NEON_URL:-}" ] || fail "NEON_URL not set"
[ -n "${RDS_URL:-}" ]  || fail "RDS_URL not set"

export PGCONNECT_TIMEOUT=30
DUMP=/tmp/neon.dump

# libpq (psql/pg_dump/pg_restore) rejects driver-specific sslmode values such as
# "no-verify" (what the app's Node `pg` client uses in the RDS secret). Normalize
# to the libpq equivalent: SSL required, server cert NOT verified. Value is never
# printed. Neon's URL already uses a libpq-valid sslmode; guarded the same way.
RDS_URL="${RDS_URL/sslmode=no-verify/sslmode=require}"
NEON_URL="${NEON_URL/sslmode=no-verify/sslmode=require}"

echo "=== client version ==="
pg_dump --version

echo "=== 1/5 connectivity preflight ==="
psql "$NEON_URL" -tAc "select 'neon ok', version()" || fail "cannot reach Neon"
psql "$RDS_URL"  -tAc "select 'rds ok',  version()" || fail "cannot reach RDS"

echo "=== 2/5 dump Neon (custom format, --no-owner --no-acl) ==="
pg_dump "$NEON_URL" --no-owner --no-acl -Fc -f "$DUMP" || fail "pg_dump failed"
ls -la "$DUMP"

echo "=== 3/5 restore into RDS (--clean --if-exists --no-owner) ==="
# Not --single-transaction: an unknown-GUC notice from 18->16 must not abort the
# load. Exit code is captured but NOT treated as fatal; row counts verify below.
set +e
pg_restore --clean --if-exists --no-owner -d "$RDS_URL" "$DUMP"
rc=$?
set -e 2>/dev/null || true
echo "pg_restore exit code: $rc (non-fatal; verified by row counts)"

echo "=== 4/5 apply idempotent challenge-timer migration ==="
# Redundant when the Neon dump already carries these columns (it does), but the
# brief requires ensuring they are present. Every statement is idempotent.
psql "$RDS_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS draw_seconds integer NOT NULL DEFAULT 300;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS toolset text;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS background_ref text;
-- deadline_at only exists on pre-migration DBs; guard so this is a no-op once the
-- current (Neon) schema, which has already dropped the column, is restored.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name='challenges' AND column_name='deadline_at') THEN
    ALTER TABLE challenges ALTER COLUMN deadline_at DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_kind_check;
ALTER TABLE channels ADD CONSTRAINT channels_kind_check CHECK (kind IN ('group', 'challenge'));
SQL
echo "migration applied"

echo "=== 5/5 row-count verification (Neon vs RDS) ==="
# Enumerate the source tables dynamically so the report covers whatever actually
# exists in Neon (incl. tables not in the checked-in schema.sql, e.g. comments).
tables=$(psql "$NEON_URL" -tAc \
  "select tablename from pg_tables where schemaname='public' order by tablename")
[ -n "$tables" ] || fail "no public tables found in Neon"

mismatch=0
printf '%-24s %-10s %-10s %s\n' TABLE NEON RDS STATUS
printf '%-24s %-10s %-10s %s\n' ------ ---- --- ------
for t in $tables; do
  n=$(psql "$NEON_URL" -tAc "select count(*) from public.\"$t\"" 2>/dev/null || echo ERR)
  r=$(psql "$RDS_URL"  -tAc "select count(*) from public.\"$t\"" 2>/dev/null || echo ERR)
  if [ "$n" = "$r" ]; then status=OK; else status=MISMATCH; mismatch=$((mismatch+1)); fi
  printf '%-24s %-10s %-10s %s\n' "$t" "$n" "$r" "$status"
done

echo "----"
if [ "$mismatch" -ne 0 ]; then
  fail "$mismatch table(s) mismatched between Neon and RDS"
fi
echo "SEED OK: all tables match."
