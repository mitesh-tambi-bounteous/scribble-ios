# syntax=docker/dockerfile:1
#
# Scribl API container — runs backend/local-server.ts (node:http server, all
# routes, /health, CORS) on $PORT (default 8787). Target: AWS App Runner
# (linux/amd64).
#
# -----------------------------------------------------------------------------
# BUILD CONTEXT MUST BE THE REPO ROOT.
#   Build (from repo root):
#     docker build --platform=linux/amd64 -f backend/Dockerfile -t scribl-api .
#   The trailing "." is the repo root. This Dockerfile lives at backend/Dockerfile
#   but expects the context one level up because backend/ imports code from the
#   sibling packages/ tree (see "packages/ resolution" note below).
#
#   --platform=linux/amd64 matters when building on Apple Silicon: it ensures
#   npm downloads the linux-x64 prebuilt binaries for `sharp` (App Runner runs
#   amd64). Omitting it on an arm host yields arm64 sharp binaries that fail on
#   App Runner.
# -----------------------------------------------------------------------------
#
# Single stage, on purpose: we run the TypeScript entrypoint directly with
# ts-node (mirroring `npm run api` = `ts-node local-server.ts`), so ts-node +
# typescript (backend devDependencies) are runtime requirements — there is no
# compiled dist/ to hand to a slim runtime stage. Correctness over cleverness
# for this POC.
FROM node:20-bookworm-slim

# --- Native deps note ------------------------------------------------------
# Backend runtime deps include `sharp` (image processing) and `pg` /
# `@neondatabase/serverless` (Postgres). On node:20-bookworm-slim:
#   * sharp 0.33 installs prebuilt libvips binaries (via its @img/sharp-linux-x64
#     optional dep) — NO system libvips or build toolchain required.
#   * pg and @neondatabase/serverless are pure JS — no native build.
# So we deliberately do NOT install build-essential/python3. If a future dep
# needs to compile from source (node-gyp), add:
#   RUN apt-get update && apt-get install -y --no-install-recommends \
#         build-essential python3 && rm -rf /var/lib/apt/lists/*
# ---------------------------------------------------------------------------

# NOTE: NODE_ENV is intentionally NOT set here. `npm ci` honors
# NODE_ENV=production and OMITS devDependencies — but ts-node + typescript are
# backend devDependencies required at runtime by our CMD. NODE_ENV=production is
# set LATER, after both install steps, so the running server still gets it.
ENV \
    # App Runner overrides PORT if it wants; local-server.ts reads process.env.PORT
    # (Number(process.env.PORT ?? 8787)).
    PORT=8787 \
    # Boot-time robustness: run ts-node in transpile-only mode. `npm run api`
    # locally does a full type-check on startup, which is slow and can fail a
    # container boot on a pre-existing type error unrelated to running. All
    # cross-package imports the server actually needs at runtime are either
    # relative paths (packages/claude-provider-adapter/*) or `import type`
    # (@scribl/shared/*, aws-lambda), so transpile-only changes nothing about
    # module resolution — it only skips type-checking. See tsconfig-paths note.
    TS_NODE_TRANSPILE_ONLY=1

# WORKDIR is the repo-root equivalent inside the image; we install here first,
# then switch into backend/ for the runtime CMD. This preserves the on-disk
# layout backend/ expects: ../packages/* and repo-root node_modules.
WORKDIR /app

# --- Backend dependencies (cache layer) ------------------------------------
# Copy only the manifest + lockfile first so `npm ci` is cached until deps
# change. Full install (incl. devDependencies) because ts-node + typescript
# are devDependencies and are REQUIRED at runtime for this ts-node entrypoint.
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# --- @anthropic-ai/sdk resolution for CLAUDE_PROVIDER=direct|bedrock -------
# DECISION: packages/claude-provider-adapter lazily `require("@anthropic-ai/sdk")`
# (adapters/direct.ts) and `require("@anthropic-ai/bedrock-sdk")`
# (adapters/bedrock.ts) — only when the corresponding provider is selected. The
# DEFAULT provider is "stub" (CLAUDE_PROVIDER unset => stub), which needs
# NEITHER SDK, so the server boots fine without them.
#
# Those SDKs are NOT in backend/package.json — they live in the ROOT
# package.json (the Expo app's). Node resolves the require() from
# packages/claude-provider-adapter/adapters/*.ts by walking up to the nearest
# node_modules, i.e. /app/node_modules (the repo-root position). Rather than run
# a full root `npm ci` (which drags in the entire Expo/React-Native toolchain,
# react-native-skia native postinstalls, etc. — heavy and fragile in a slim
# server image), we install ONLY the two SDKs into /app/node_modules, pinned to
# the versions in the root package.json (@anthropic-ai/sdk ^0.109.0,
# @anthropic-ai/bedrock-sdk ^0.32.0). Both are pure JS and install cleanly.
RUN npm install --no-save --no-package-lock --prefix /app \
      @anthropic-ai/sdk@0.109.0 \
      @anthropic-ai/bedrock-sdk@0.32.0

# Now that both installs are done (with devDependencies included), set
# NODE_ENV=production for the running server. Placed AFTER the npm steps so it
# does not cause `npm ci` to strip the ts-node/typescript devDeps we need.
ENV NODE_ENV=production

# --- Application source -----------------------------------------------------
# packages/ (shared-types + claude-provider-adapter) and backend/ source. Host
# node_modules are excluded by .dockerignore, so these COPYs never clobber the
# node_modules installed above.
COPY packages/ ./packages/
COPY backend/ ./backend/

# --- tsconfig-paths note ----------------------------------------------------
# backend/tsconfig.json maps `@scribl/shared/*` -> ../packages/shared-types/*.
# ts-node does NOT honor tsconfig `paths` at runtime on its own (it would need
# `tsconfig-paths/register`). We verified every `@scribl/shared/*` import in
# backend/ is `import type { ... }`, which TypeScript/ts-node ERASE at compile
# time — so there are zero runtime require() calls for that alias and
# tsconfig-paths is not needed. (The one value import from packages/ —
# lambda/enhance/service.ts -> ../../../packages/claude-provider-adapter/factory
# — is a relative path, resolved by Node directly.) If a future non-type import
# of @scribl/shared/* is added, add `tsconfig-paths` to backend deps and set
# TS_NODE_COMPILER_OPTIONS / add `-r tsconfig-paths/register` to the CMD.

WORKDIR /app/backend
EXPOSE 8787

# Launch the server via ts-node, mirroring `npm run api`. Uses the locally
# installed binary (no npx network lookup). PORT is honored via process.env.
# -r tsconfig-paths/register: required because backend now has runtime (value)
# imports of @scribl/shared/* (e.g. lambda/handlers/member-add.ts imports
# isValidEmail from @scribl/shared/email), which ts-node cannot resolve from the
# tsconfig `paths` mapping without it. tsconfig-paths is a backend devDep, present
# via the full `npm ci`.
CMD ["./node_modules/.bin/ts-node", "-r", "tsconfig-paths/register", "local-server.ts"]
