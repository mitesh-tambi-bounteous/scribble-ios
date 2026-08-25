# MobileApp · Concepts

<div class="block-head">
  <div class="kicker">Mental model</div>
  <h1>The 5-Layer Agent Development Kit</h1>
  <p class="lede">Claude Code isn't just AI in your terminal — it's a layered runtime. Each
  layer solves a problem prompting alone can't. The model is fixed; the harness is the durable
  lever. Adopt load-bearing layers first, and add the next one only once the previous one is
  actually working.</p>
</div>

<div class="topic">
  <span class="slide-tag">One line each · adoption order top→down</span>
  <h2>The five layers</h2>
  <div class="two-col">
    <div class="cheat">
      <h3>What each layer is</h3>
      <dl>
        <dt>1 · Memory</dt><dd><strong>CLAUDE.md</strong> — durable rules, loaded every session</dd>
        <dt>2 · Knowledge</dt><dd><strong>Skills</strong> — procedural expertise, loaded on demand</dd>
        <dt>3 · Guardrails</dt><dd><strong>Hooks</strong> — deterministic, runtime-enforced, not advisory</dd>
        <dt>4 · Delegation</dt><dd><strong>Subagents</strong> — isolated specialists, own context window</dd>
        <dt>5 · Distribution</dt><dd><strong>Plugins</strong> — package once, the team inherits</dd>
      </dl>
    </div>
    <div class="cheat">
      <h3>Most agent failures = a missing layer</h3>
      <ul>
        <li>Forgets conventions? → <strong>Memory</strong> missing.</li>
        <li>Repeats setup every time? → <strong>Knowledge</strong> missing.</li>
        <li>Inconsistent on risky actions? → <strong>Guardrails</strong> missing.</li>
        <li>Context is a swamp? → <strong>Delegation</strong> missing.</li>
        <li>Everyone reinvents the wheel? → <strong>Distribution</strong> missing.</li>
      </ul>
    </div>
  </div>
</div>

<div class="topic">
  <span class="slide-tag">Layer 1 · Memory</span>
  <h2>CLAUDE.md — durable rules</h2>
  <p>Loaded at the start of <strong>every session</strong>. Claude walks up the directory tree
  and concatenates every <code>CLAUDE.md</code> it finds; imports via <code>@path/to/file</code>
  chain up to 5 hops. <strong>Goes here:</strong> architecture rules, conventions, repo map,
  invariants. <strong>Not here:</strong> step-by-step procedures (those are Skills).</p>
  <p><strong>When to add it:</strong> first, before anything else — it's the one file every
  session reads whether or not the task needs it.</p>
  <table class="plain">
    <tr><th>File</th><th>Length / structure</th><th>Notes</th></tr>
    <tr><td><code>.claude/CLAUDE.md</code></td><td>Single, short file</td><td>The only CLAUDE.md in this repo — harness index</td></tr>
  </table>
  <div class="pitfall"><strong>Pitfall:</strong> longer ≠ better. Past ~200 lines, adherence
  drops fast. Lift long sections into <code>@import</code>ed sub-files or move procedures into
  Skills instead of growing the root file indefinitely.</div>
</div>

<div class="topic">
  <span class="slide-tag">Layer 2 · Knowledge</span>
  <h2>Skills — procedural knowledge on demand</h2>
  <p>Reusable playbooks loaded only when relevant — triggered by a slash command or
  auto-invoked when Claude matches the skill's <em>description</em> to the task at hand. Live
  in <code>.claude/skills/&lt;name&gt;/SKILL.md</code>.</p>
  <p><strong>When to add it:</strong> the moment you've pasted the same playbook into a prompt
  twice. If a teammate asks "how do we do X here" and the answer is more than a sentence,
  that's a Skill.</p>
  <table class="plain">
    <tr><th>Skill</th><th>What it does</th><th>Notes</th></tr>
    <tr><td>app-store-compliance</td><td>Checks changes against App Store / Play Store submission rules</td><td></td></tr>
    <tr><td>async-ai-pipeline</td><td>Guides work on the SQS-based async AI pipeline</td><td></td></tr>
    <tr><td>channel-isolation-testing</td><td>Tests the channel-isolation invariant</td><td><span class="badge">launch-blocking</span></td></tr>
    <tr><td>claude-provider-adapter</td><td>Guides changes to the Claude provider adapter</td><td></td></tr>
    <tr><td>skia-native-module</td><td>Guides work on the <code>@shopify/react-native-skia</code> native module</td><td></td></tr>
    <tr><td>submit-to-unlock-invariant</td><td>Tests the submit-to-unlock invariant</td><td><span class="badge">launch-blocking</span></td></tr>
  </table>
  <div class="pitfall"><strong>Pitfall:</strong> vague descriptions never auto-fire. Write the
  description like a search query — include the actual phrases people will type, not a
  generic summary of the skill's purpose.</div>
</div>

<div class="topic">
  <span class="slide-tag">Layer 3 · Guardrails</span>
  <h2>Hooks — deterministic guardrails</h2>
  <p>Shell commands wired to lifecycle events (<code>PreToolUse</code>, <code>PostToolUse</code>,
  <code>SessionStart</code>, <code>Stop</code>, <code>SubagentStop</code>). The
  <strong>runtime</strong> decides if they run, not the model. Hooks read JSON on stdin
  describing the proposed tool call; exit code <code>2</code> with a <code>"reason"</code>
  field blocks the action and tells Claude why, so it can course-correct instead of failing
  silently.</p>
  <p><strong>When to add it:</strong> when "please don't do X" in CLAUDE.md isn't enough and X
  must be <em>impossible</em> — secrets in commits, force-push to main, writes to
  <code>.env</code> files, malformed branch names. Advisory instructions get forgotten under
  pressure; a hook cannot be talked out of firing.</p>
  <table class="plain">
    <tr><th>Hook</th><th>Fires on</th><th>What it does</th></tr>
    <tr><td>worktree-guard</td><td>PreToolUse · Bash</td><td>Blocks edits outside a worktree.</td></tr>
    <tr><td>secrets-scan</td><td>PreToolUse · Edit|Write|Bash</td><td>Blocks writes/commands that would leak secrets.</td></tr>
    <tr><td>invariant-guard</td><td>PreToolUse · Bash</td><td>Blocks bash commands that would violate a launch-blocking invariant (submit-to-unlock / channel-isolation).</td></tr>
    <tr><td>advisory-checks</td><td>PostToolUse · Edit|Write</td><td>Runs non-blocking advisory checks after edits.</td></tr>
    <tr><td>verify-reminder</td><td>Stop</td><td>Reminds to verify before stopping.</td></tr>
  </table>
  <div class="pitfall"><strong>Pitfall:</strong> hooks fail silently if the command isn't
  resolvable on PATH from wherever the hook actually runs. Test the hook standalone (pipe it a
  sample JSON payload, check the exit code) before trusting it in production, then run
  <code>/doctor</code> to confirm the harness sees it.</div>
</div>

<div class="topic">
  <span class="slide-tag">Layer 4 · Delegation</span>
  <h2>Subagents — isolated specialists</h2>
  <p>Workers the main agent dispatches to. Each runs in its <strong>own context window</strong>,
  own tool permissions, optionally a cheaper or faster model. The main agent gets a summary
  back, not the noise. Built-ins include <code>Explore</code>, <code>Plan</code>, and
  <code>general-purpose</code>; a repo can also define its own in <code>.claude/agents/</code>.
  <strong>Subagents can't spawn subagents</strong> — no infinite nesting.</p>
  <p><strong>When to add it:</strong> when a side task is more than roughly five tool calls, or
  produces logs and exploratory output you don't want cluttering the main thread. Fan out
  independent subtasks in parallel; keep the main agent as orchestrator, not implementer, once
  the work crosses that threshold.</p>
  <table class="plain">
    <tr><th>Subagent</th><th>What it does</th></tr>
    <tr><td>adr-author</td><td>Writes architecture decision records</td></tr>
    <tr><td>ai-service-builder</td><td>Builds AI-service integration code</td></tr>
    <tr><td>backend-builder</td><td>Builds AWS CDK backend code</td></tr>
    <tr><td>code-reviewer</td><td>Reviews code changes</td></tr>
    <tr><td>rn-builder</td><td>Builds React Native / Expo UI code</td></tr>
    <tr><td>test-author</td><td>Writes tests</td></tr>
  </table>
  <div class="pitfall"><strong>Pitfall:</strong> don't dispatch a subagent for one trivial
  action — the context-switch and summarization cost beats whatever context it would have
  saved.</div>
</div>

<div class="topic">
  <span class="slide-tag">Layer 5 · Distribution</span>
  <h2>Plugins — package once, team inherits</h2>
  <p>Versioned bundles of skills + subagents + hooks + commands. One person enables a plugin,
  the whole team gets the same behavior — no copy-pasting a <code>.claude/</code> directory
  between repos and letting the copies drift apart.</p>
  <p><strong>When to add it:</strong> when more than one person needs the same skill/hook set
  and you want versioned, reviewable distribution instead of tribal-knowledge copy-paste. A
  plugin is also the right home for anything you want to reuse across multiple repos, not just
  this one.</p>
  <table class="plain">
    <tr><th>Plugin</th><th>What it provides</th></tr>
    <tr><td>superpowers</td><td>Brainstorm / plan / execute / verify skills</td></tr>
    <tr><td>code-review</td><td>Plan + diff review</td></tr>
    <tr><td>commit-commands</td><td>Commit / push / PR in one command</td></tr>
    <tr><td>pr-review-toolkit</td><td>Comprehensive PR review</td></tr>
    <tr><td>claude-md-management</td><td>Audits/improves CLAUDE.md files</td></tr>
  </table>
</div>

<div class="topic">
  <span class="slide-tag">Diagnostic lookup</span>
  <h2>Failure-mode → layer table</h2>
  <table class="plain">
    <tr><th>Symptom</th><th>Missing layer</th><th>Fix</th></tr>
    <tr><td>Re-explains the codebase / breaks conventions</td><td>1 · Memory</td><td>Add or tighten <code>CLAUDE.md</code></td></tr>
    <tr><td>Asks you to re-describe a multi-step procedure</td><td>2 · Knowledge</td><td>Capture it as a Skill</td></tr>
    <tr><td>Sometimes commits secrets / force-pushes</td><td>3 · Guardrails</td><td>Add a <code>PreToolUse</code> hook</td></tr>
    <tr><td>Main thread drowns in test/log output</td><td>4 · Delegation</td><td>Dispatch a subagent</td></tr>
    <tr><td>Each engineer rebuilds the same setup</td><td>5 · Distribution</td><td>Ship it as a plugin</td></tr>
  </table>
  <div class="insight"><strong>Rule of thumb:</strong> adopt top-down. Add the next layer only
  when the previous one works — nothing downstream helps if Memory is wrong.</div>
  <a class="doc-link" href="https://www.anthropic.com/engineering/claude-code-best-practices" target="_blank" rel="noopener">Anthropic · Claude Code best practices</a>
</div>
