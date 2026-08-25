# MobileApp · Setup & config

<div class="block-head">
  <div class="kicker">Before your first task</div>
  <h1>Setup &amp; configuration</h1>
  <p class="lede">Get the harness, wire the hooks, confirm the MCP servers and plugins load,
  and learn the one tool that fixes the harness when it misbehaves.</p>
</div>

<div class="topic">
  <span class="slide-tag">a · Claude access</span>
  <h2>Confirm Claude Code is installed</h2>
  <p>You need the Claude Code CLI installed and able to launch. From any directory, run
  <code>claude --version</code>, then <code>claude</code> to start a session.</p>
  <div class="step plain"><div><h3>Claude Code installed &amp; launches</h3><p><code>claude --version</code>
  prints a version and <code>claude</code> opens a session.</p></div></div>
</div>

<div class="topic">
  <span class="slide-tag">b · Get the harness</span>
  <h2>Pull MobileApp and its <code>.claude/</code> harness</h2>
  <p>The harness (CLAUDE.md, skills, agents, hooks) ships committed in <code>.claude/</code> —
  no separate install step once you have the repo checked out.</p>
</div>

<div class="topic">
  <span class="slide-tag">c · One-time hooks</span>
  <h2>What's already wired</h2>
  <p>Hooks run automatically once you have the repo checked out — no separate install step
  unless noted below.</p>
  <div class="steps">
    <div class="step plain"><div><h3>worktree-guard <span class="badge repo">REPO</span></h3><p>PreToolUse · Bash — blocks edits outside a worktree.</p></div></div>
    <div class="step plain"><div><h3>secrets-scan <span class="badge repo">REPO</span></h3><p>PreToolUse · Edit|Write|Bash — blocks writes/commands that would leak secrets.</p></div></div>
    <div class="step plain"><div><h3>invariant-guard <span class="badge repo">REPO</span></h3><p>PreToolUse · Bash — blocks bash commands that would violate a launch-blocking invariant (submit-to-unlock / channel-isolation).</p></div></div>
    <div class="step plain"><div><h3>advisory-checks <span class="badge repo">REPO</span></h3><p>PostToolUse · Edit|Write — runs non-blocking advisory checks after edits.</p></div></div>
    <div class="step plain"><div><h3>verify-reminder <span class="badge repo">REPO</span></h3><p>Stop — reminds to verify before stopping.</p></div></div>
  </div>
  <div class="step plain"><div><h3>Ran <code>/arc-setup-hooks</code> <span class="badge repo">REPO</span></h3>
  <p>One-time per clone. Wires git-level hooks if this repo tracks any under
  <code>.githooks/</code>; a no-op otherwise (this repo's hooks may already be fully
  enforced via <code>.claude/settings.json</code> alone).
  This repo has no <code>.githooks/</code> directory, so this command is a no-op here.</p></div></div>
</div>

<div class="topic">
  <span class="slide-tag">d · MCP setup</span>
  <h2>Configure &amp; verify this repo's MCP servers</h2>
  <p>MCP servers extend Claude Code with tools for external systems (tickets, docs, internal
  APIs, databases). Verify what's loaded with <code>claude mcp list</code>.</p>
  <div class="code-block"><pre>claude mcp list</pre></div>
  <div class="steps" style="margin-top:14px;">
    <div class="step plain">
      <div><h3>Not yet wired: <code>github</code></h3><p>stdio transport — needs <code>GITHUB_PERSONAL_ACCESS_TOKEN</code>.</p></div>
    </div>
    <div class="step plain">
      <div><h3>Not yet wired: <code>atlassian</code></h3><p>http transport — interactive OAuth.</p></div>
    </div>
  </div>
</div>

<div class="topic">
  <span class="slide-tag">e · Plugins</span>
  <h2>The recommended plugin bundle</h2>
  <p>These five cover the full brainstorm-to-PR-review loop (see the Brainstorm tab). Browse or
  install via <code>/plugin</code>.</p>
  <div class="steps">
    <div class="step plain"><div><h3><code>superpowers</code> <span class="badge plugin">PLUGIN</span></h3><p>Brainstorm / plan / execute / verify skills — the core SDLC loop.</p></div></div>
    <div class="step plain"><div><h3><code>code-review</code> <span class="badge plugin">PLUGIN</span></h3><p>Plan + diff review.</p></div></div>
    <div class="step plain"><div><h3><code>commit-commands</code> <span class="badge plugin">PLUGIN</span></h3><p>Commit / push / PR in one command.</p></div></div>
    <div class="step plain"><div><h3><code>pr-review-toolkit</code> <span class="badge plugin">PLUGIN</span></h3><p>Comprehensive PR review.</p></div></div>
    <div class="step plain"><div><h3><code>claude-md-management</code> <span class="badge plugin">PLUGIN</span></h3><p>Audits and improves CLAUDE.md files — see the topic below.</p></div></div>
  </div>
  <div class="code-block"><pre># Browse / install
/plugin

# Or add the official marketplace and install by name
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official</pre></div>
  <p>All five are enabled in this repo's <code>.claude/settings.json</code>
       <code>enabledPlugins</code>: <code>superpowers</code>, <code>code-review</code>,
       <code>commit-commands</code>, <code>pr-review-toolkit</code>, and
       <code>claude-md-management</code>.</p>
</div>

<div class="topic">
  <span class="slide-tag">f · claude-md-management</span>
  <h2>The tool you reach for when CLAUDE.md drifts</h2>
  <p><code>claude-md-management</code> <span class="badge plugin">PLUGIN</span> audits and
  improves CLAUDE.md files — the harness's memory layer. Run the
  <code>claude-md-management:revise-claude-md</code> command, or invoke the
  <code>claude-md-improver</code> skill directly.</p>
  <div class="insight"><strong>When to use it:</strong> if the harness misbehaves — Claude
  forgets a rule, a CLAUDE.md is stale or wrong, or something doesn't work the way you want —
  run <code>claude-md-management</code> to audit and fix the relevant CLAUDE.md, then note what
  you changed. It's also useful for improving other instruction files (commands, skills) that
  follow the same "durable written instructions" pattern.</div>
  <p><strong>Mini-exercise:</strong> pick a CLAUDE.md (the repo root, <code>.claude/CLAUDE.md</code>,
  or your own global one), run the tool, let it propose improvements, apply one, and note the
  before/after.</p>
</div>

<div class="topic">
  <span class="slide-tag">g · The tool you reach for when the harness misbehaves</span>
  <h2>Run <code>/context</code> first, always</h2>
  <p><code>/context</code> shows everything actually loaded right now: every CLAUDE.md (and
  which one), every <code>@import</code>, active skills, hooks, plugins, and MCP servers. When
  Claude forgets a rule, a CLAUDE.md is stale, or something doesn't behave the way you expect —
  this is the fastest way to tell "not installed" from "installed but not doing what I
  expect."</p>
  <p>This repo has <code>claude-md-management</code> <span class="badge plugin">PLUGIN</span>
  enabled — run <code>claude-md-management:revise-claude-md</code> to audit/improve a
  CLAUDE.md.</p>
</div>

<div class="insight"><strong>Keep this current:</strong> re-run the <code>/arc-help</code>
builder command whenever plugins or MCP servers change — this tab reflects this repo's actual
footprint, not a shared template.</div>
