# @scribl/shared-types

Type-only contract shared across the Scribl POC: the Expo app, the backend
Lambdas, and the Claude provider adapter. **No runtime code** — these erase at
build, so neither Metro nor any bundler needs to resolve this as a package.

Consume via tsconfig path alias:

```jsonc
// root tsconfig.json / backend tsconfig.json
"paths": { "@scribl/shared/*": ["./packages/shared-types/*"] }
```

```ts
import type { Prompt, TodayPromptResponse } from "@scribl/shared/index";
```

Stories S-001..S-008 extend these shapes as the daily loop lands. Keep additions
backward-compatible where a story builds on an earlier one.
