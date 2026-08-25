# Multi-repo roled brain

One brain owns the contract -- stories, briefs, acceptance criteria, gates, and
the board -- and drives N roled code repos (mobile, backend, ai, db, infra). The
HOP workers are the muscle that build in each repo's worktrees; the brain never
holds code, only the contract.

## Situation

An engagement spans more than one code repo. A single mobile-app pointer cannot
express work that also touches a backend service, an ai component, a database,
or infra. The brain needs to track and drive all of them while staying the
single source of the contract.

## Approach

- `project.json` carries a `repos[]` array, each entry naming a repo and a role
  drawn from mobile | backend | ai | db | infra.
- Commands and stories carry a repo/role target, so each work item names where
  its code lives and build/verify work lands in the right worktrees.
- The brain stays the single source of the contract (stories, briefs, AC,
  gates, board); code lives in the role-specific repos.

## When NOT to use

- A single-repo POC or a solo codebase. The extra indirection is pure overhead
  there -- a single `code_repo` pointer is simpler and just as correct.
