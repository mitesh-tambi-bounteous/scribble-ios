# MobileApp · Quick reference

<div class="block-head">
  <div class="kicker">The one-pager</div>
  <h1>Quick reference</h1>
  <p class="lede">The cheat sheet inside the cheat sheet. Print this page or keep the tab open —
  everything else in this sheet is one click away, but this is the version you skim.</p>
</div>

<div class="qr-grid">
  <div class="qr">
    <h3>About MobileApp</h3>
    <ul>
      <li>MobileApp (a.k.a. Scribl) — a mobile drawing/social app</li>
      <li>Expo ~56, React Native 0.85, React 19, expo-router, NativeWind, RN Reusables, Zustand, <code>@shopify/react-native-skia</code>, AWS CDK backend</li>
    </ul>
    <p><a href="https://github.com/rforsh/MobileApp">https://github.com/rforsh/MobileApp</a></p>
  </div>
  <div class="qr">
    <h3>This repo's commands, skills &amp; hooks</h3>
    <ul>
      <li><code>/arc-help</code> — this cheat sheet</li>
      <li><code>submit-to-unlock-invariant</code>, <code>channel-isolation-testing</code> — launch-blocking skills</li>
      <li>5 all-5-plugin-enabled: superpowers, code-review, commit-commands, pr-review-toolkit, claude-md-management</li>
      <li>See the <strong>Concepts</strong> tab for the full per-layer inventory</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Built-in slash commands</h3>
    <ul>
      <li><code>/init</code> — bootstrap CLAUDE.md</li>
      <li><code>/context</code> — see everything loaded</li>
      <li><code>/agents</code> — list/dispatch subagents</li>
      <li><code>/skills</code> · <code>/hooks</code> · <code>/mcp</code> — introspect</li>
      <li><code>/plugin</code> — browse / install plugins</li>
      <li><code>/doctor</code> — diagnose drift</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Plan-mode walkthrough</h3>
    <ul>
      <li><strong>1</strong> Enter plan mode (Shift+Tab)</li>
      <li><strong>2</strong> State the goal; ask for a worktree</li>
      <li><strong>3</strong> Review the plan (<code>/code-review</code>)</li>
      <li><strong>4</strong> Approve → Claude creates the worktree → implements</li>
      <li><strong>5</strong> Review the diff</li>
      <li><strong>6</strong> Commit</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Brainstorm walkthrough</h3>
    <ul>
      <li><strong>1</strong> Brainstorm in a worktree → design file</li>
      <li><strong>2</strong> Writing-plans → implementation file</li>
      <li><strong>3</strong> Review the plan</li>
      <li><strong>4</strong> Execute (agent teams, dispatched in parallel)</li>
      <li><strong>5</strong> Verify</li>
      <li><strong>6</strong> Commit + PR</li>
      <li><strong>7</strong> PR review</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Worktrees &amp; setup</h3>
    <ul>
      <li>Never edit code directly on <code>main</code>/the primary checkout</li>
      <li>Ask Claude for a worktree in your prompt — it runs <code>git worktree add</code> for
      you; you just see a new branch</li>
      <li>One session per worktree</li>
      <li><code>git worktree list</code> to see what's active</li>
      <li><code>git worktree remove &lt;path&gt;</code> once merged</li>
    </ul>
  </div>
  <div class="qr">
    <h3>MCP servers</h3>
    <ul>
      <li>Not yet wired — needed: <code>github</code> (stdio, <code>GITHUB_PERSONAL_ACCESS_TOKEN</code>)</li>
      <li>Not yet wired — needed: <code>atlassian</code> (http, interactive OAuth)</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Auto vs Ask</h3>
    <ul>
      <li><strong>Auto:</strong> boilerplate, tests, generated code, reversible edits</li>
      <li><strong>Ask:</strong> auth, billing, schema changes, infra, deploys</li>
      <li>Irreversible → Ask</li>
      <li>Touching <code>.claude/</code> config → Ask</li>
      <li>In doubt → Ask</li>
    </ul>
  </div>
  <div class="qr">
    <h3>5-layer Agent Development Kit</h3>
    <ul>
      <li><strong>1</strong> Memory — CLAUDE.md</li>
      <li><strong>2</strong> Knowledge — Skills</li>
      <li><strong>3</strong> Guardrails — Hooks</li>
      <li><strong>4</strong> Delegation — Subagents</li>
      <li><strong>5</strong> Distribution — Plugins</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Key files</h3>
    <ul>
      <li><code>.claude/CLAUDE.md</code> — harness index</li>
      <li><code>.claude/settings.json</code> — hooks, plugins, permissions</li>
      <li><code>.claude/hooks/</code> — guardrail scripts</li>
      <li><code>.claude/help/</code> — this generated cheat sheet</li>
      <li><code>.claude/agents/</code> — 6 custom subagents</li>
      <li><code>.claude/skills/</code> — 6 skills, incl. 2 launch-blocking invariants</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Planning-prompt checklist</h3>
    <ul>
      <li><strong>Goal + context</strong> — state the outcome; link the ticket/issue if there is one</li>
      <li><strong>Worktree</strong> — ask Claude to work in one; you just see a branch</li>
      <li><strong>Agent teams</strong> — task list + dependencies, dispatched in parallel</li>
      <li><strong>Right-size models</strong> — cheaper/faster models for validation-only agents</li>
      <li><strong>"Be brief"</strong> — keep output concise when you don't need the narration</li>
    </ul>
  </div>
  <div class="qr">
    <h3>What makes a good prompt</h3>
    <ul>
      <li><strong>Output contract first</strong> — say what "done" looks like</li>
      <li><strong>Structure it</strong> — goal / context+files / constraints</li>
      <li><strong>Examples</strong> — show the format (few-shot); show reasoning for tricky logic</li>
      <li><strong>Make it verifiable</strong> — explicit success criteria</li>
      <li><strong>Measure, then compress</strong> — check the result; keep context tight</li>
    </ul>
  </div>
  <div class="qr">
    <h3>Tips from the field</h3>
    <ul>
      <li><strong>Prompt the goal, not the implementation</strong> — keep it short; let Claude find the files</li>
      <li><strong>Read what Claude says</strong> — not just the diff; if tone/format is off, say so ("be brief")</li>
      <li><strong>Roast the plan</strong> — ask Claude to grill its own plan, then respond section-by-section</li>
      <li><strong>Give a reference codebase</strong> — clone a relevant repo, point Claude at the path</li>
      <li><strong>Use screenshots</strong> — paste an image of the error/log/UI instead of describing it</li>
      <li><strong>Let the agent verify its own work</strong> — tests / CLI / computer-use; loop a review tool until clean</li>
    </ul>
  </div>
</div>

## Official docs · open in browser

<a class="doc-link" href="https://code.claude.com/docs/en/memory" target="_blank" rel="noopener">Memory · CLAUDE.md</a>
<a class="doc-link" href="https://code.claude.com/docs/en/skills" target="_blank" rel="noopener">Skills</a>
<a class="doc-link" href="https://code.claude.com/docs/en/hooks" target="_blank" rel="noopener">Hooks</a>
<a class="doc-link" href="https://code.claude.com/docs/en/sub-agents" target="_blank" rel="noopener">Subagents</a>
<a class="doc-link" href="https://code.claude.com/docs/en/plugins" target="_blank" rel="noopener">Plugins</a>
<a class="doc-link" href="https://code.claude.com/docs/en/mcp" target="_blank" rel="noopener">MCP</a>
