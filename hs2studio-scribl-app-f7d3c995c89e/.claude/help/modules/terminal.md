# MobileApp · Terminal

<div class="block-head">
  <div class="kicker">Driving the CLI</div>
  <h1>Working in the terminal</h1>
  <p class="lede">Four input modes, the slash commands you'll reach for, plan mode, the
  auto-vs-ask call, and the worktree pattern Claude runs for you under the hood.</p>
</div>

<div class="topic">
  <span class="slide-tag">Input modes</span>
  <h2>The four ways to talk to Claude Code</h2>
  <ul>
    <li><strong>Prose</strong> — natural language. The default. "Find every TODO, group by
    file, change nothing."</li>
    <li><strong>Slash commands</strong> — <code>/init</code>, <code>/context</code>,
    <code>/arc-help</code>… Built-ins, repo commands, and plugin commands all surface here.</li>
    <li><strong>Bash bang</strong> — <code>!npm test</code> runs a shell command inline
    without leaving the session.</li>
    <li><strong>File references</strong> — <code>@src/foo.ts</code> pulls a file's contents
    inline; <code>@docs/</code> tab-completes paths.</li>
  </ul>
  <div class="insight"><strong>Keybindings:</strong> <code>?</code> opens the keybindings
  menu · <code>Shift+Tab</code> toggles plan mode · <code>esc</code> interrupts mid-stream ·
  <code>Ctrl-R</code> recent prompts · <code>Ctrl-C</code> cancel.</div>
</div>

<div class="topic">
  <span class="slide-tag">Introspection first</span>
  <h2>Key slash commands</h2>
  <h4>Built-in slash commands</h4>
  <ul>
    <li><code>/init</code> — bootstrap CLAUDE.md by walking the repo. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/context</code> — see <strong>everything</strong> loaded right now: every
    CLAUDE.md, skill, hook, plugin, MCP server. When Claude does something weird, run this
    first. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/skills</code> — list installed skills. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/hooks</code> — list configured hooks. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/mcp</code> — list MCP servers. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/agents</code> — list/dispatch subagents. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/plugin</code> — browse/install plugins. <span class="badge builtin">BUILT-IN</span></li>
    <li><code>/doctor</code> — diagnose hooks/MCP/settings drift. <span class="badge builtin">BUILT-IN</span></li>
  </ul>
  <h4>This repo's commands</h4>
  <ul>
    <li><code>/arc-help</code> — this cheat sheet. <span class="badge repo">REPO</span></li>
    <li><code>/arc-setup-hooks</code> — one-time per-clone hook setup (no-op here; no <code>.githooks/</code>). <span class="badge repo">REPO</span></li>
  </ul>
  <h4>Plugin commands</h4>
  <ul>
    <li><code>/superpowers:brainstorming</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/superpowers:writing-plans</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/superpowers:executing-plans</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/superpowers:verification-before-completion</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/code-review [file]</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/commit-commands:commit-push-pr</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/pr-review-toolkit:review-pr</code> <span class="badge plugin">PLUGIN</span></li>
    <li><code>/claude-md-management:revise-claude-md</code> <span class="badge plugin">PLUGIN</span></li>
  </ul>
</div>

<div class="topic">
  <span class="slide-tag">The safety net</span>
  <h2>Plan mode</h2>
  <p>Plan mode is read-only: Claude reads, searches, and explores but <strong>cannot edit,
  write, or run state-changing commands</strong> until you approve the plan. Toggle with
  <code>Shift+Tab</code>. Use it for any non-trivial change — new features, refactors,
  anything touching more than one file.</p>
  <div class="insight"><strong>Why it matters:</strong> plan mode turns "did Claude
  understand the task?" into a checkpoint you can inspect <em>before</em> any file changes,
  instead of discovering a misread requirement three edits in.</div>
</div>

<div class="topic">
  <span class="slide-tag">Permission discipline</span>
  <h2>Auto vs Ask — the decision matrix</h2>
  <table class="plain">
    <tr><th>Situation</th><th>Mode</th><th>Why</th></tr>
    <tr><td>Boilerplate, scaffolding, generated code</td><td><strong>Auto</strong></td><td>Reversible, low blast radius</td></tr>
    <tr><td>Tests, formatting, local-only edits</td><td><strong>Auto</strong></td><td>Caught by CI / easy to revert</td></tr>
    <tr><td>Auth, billing, schema, migrations, infra</td><td><strong>Ask</strong></td><td>High blast radius</td></tr>
    <tr><td>Anything irreversible (deletes, force-push, prod)</td><td><strong>Ask</strong></td><td>No undo</td></tr>
    <tr><td>Editing the <code>.claude/</code> harness itself</td><td><strong>Ask</strong></td><td>Changes behavior for everyone</td></tr>
    <tr><td>When in doubt</td><td><strong>Ask</strong></td><td>Cheaper than cleanup</td></tr>
  </table>
  <div class="pitfall"><strong>Backstop:</strong> hooks can make the riskiest "Ask" cases
  <em>impossible</em> regardless of mode — see the Concepts tab's Guardrails layer. Configure
  them for anything a permission prompt alone isn't strict enough to catch (secret commits,
  protected files, dangerous shell patterns).</div>
</div>

<div class="topic">
  <span class="slide-tag">Under the hood</span>
  <h2>The worktree pattern</h2>
  <p><code>git worktree add</code> checks out a branch into its own directory, sibling to
  the main checkout, with its own working tree but sharing the same <code>.git</code>
  history. That gives every task an isolated workspace: no stashing, no branch-switching
  churn, no risk of two sessions colliding on the same files.</p>
  <div class="code-block">
    <div class="ck-head"><span class="ck-label">Typical pattern</span><span class="ck-file">terminal</span></div>
<pre><span class="c"># Claude runs this when you ask in your prompt — you don't type it yourself</span>
git worktree add ../REPO-wt/&lt;slug&gt;/ -b &lt;slug&gt;
cd ../REPO-wt/&lt;slug&gt;/

<span class="c"># Verify before any edit</span>
git worktree list

<span class="c"># Cleanup when the task is done or abandoned</span>
git worktree remove ../REPO-wt/&lt;slug&gt;/</pre>
  </div>
  <div class="insight"><strong>One session per worktree.</strong> Never edit <code>main</code>
  (or your primary branch) directly in the main checkout for real work — stray edits there
  are the most common way a session's changes get lost or tangled with another session's.</div>
  <p>This repo uses the standard convention: <code>git worktree add ~/src/MobileApp-wt/&lt;slug&gt;/ -b &lt;slug&gt;</code>.</p>
</div>
