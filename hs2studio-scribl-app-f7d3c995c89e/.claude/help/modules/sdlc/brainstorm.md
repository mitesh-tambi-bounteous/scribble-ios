# MobileApp · Brainstorm

<div class="block-head">
  <div class="kicker">Walkthrough · the superpowers-style workflow</div>
  <h1>Ship the same change with brainstorming</h1>
  <p class="lede">
    Brainstorming is the entry path for open-ended or underspecified work: the requirements
    aren't fully known yet, or there are real design tradeoffs worth talking through before any
    code gets written. It converges on a written plan, which then flows into the same review
    and execute path as plan mode.
  </p>
  <span class="timing">brainstorm → design → writing-plans → review → execute → verify → commit/PR → PR review</span>
  <div class="legend">
    <span><span class="badge repo">repo</span> shipped in this repo's <code>.claude/</code></span>
    <span><span class="badge plugin">plugin</span> auto-enabled via <code>settings.json</code></span>
    <span><span class="badge builtin">built-in</span> native Claude Code</span>
  </div>
</div>

<div class="steps">

<div class="step plain">
<div>
<h3>Brainstorm — state the goal, converge on a design</h3>
<p>Launch brainstorming and give it your goal plus any relevant context (the problem,
constraints, prior attempts). It surfaces assumptions and narrows scope, then produces a
written design.</p>
<h4>What to put in your prompt</h4>
<ul>
<li><strong>Goal + ticket</strong> — state the outcome; reference your tracked work item if you use one</li>
<li><strong>Worktree</strong> — tell Claude to work in one; it creates one, you just see a branch</li>
<li><strong>Agent teams</strong> — ask for a task list with dependencies + dispatched agent teams so independent tasks run in parallel</li>
<li><strong>Right-size models</strong> — set each agent's model to its job; use Haiku for validation/check agents (faster, cheaper, more parallel headroom)</li>
<li><strong>"Be brief"</strong> — add the words "be brief" to keep output concise</li>
</ul>
<div class="cmds"><code>/superpowers:brainstorming</code> <span class="badge plugin">plugin</span></div>
<p>The <code>superpowers</code>, <code>code-review</code>, <code>commit-commands</code>, and
<code>pr-review-toolkit</code> plugins are all enabled in this repo's <code>.claude/settings.json</code>
<code>enabledPlugins</code>.</p>
</div>
</div>

<div class="step plain">
<div>
<h3>Convert the design into an implementation plan</h3>
<p>Run writing-plans against the design produced above — it converts the design into a
concrete implementation plan file, the artifact the next steps review and execute against.</p>
<div class="cmds"><code>/superpowers:writing-plans</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Review the plan file</h3>
<p>Point a code review at the plan file before building anything against it. Iterate until
there are no blocking findings — a bad plan caught here costs minutes, not hours.</p>
<div class="cmds"><code>/code-review [plan-file]</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Execute the plan</h3>
<p>The execution skill enforces TaskCreate-first orchestration: break the plan into tasks with
real dependencies, dispatch independent tasks in one message with multiple agent calls, and
keep the main agent as orchestrator while builder agents do the editing.</p>
<div class="cmds"><code>/superpowers:executing-plans</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Verify — run tests, read the output</h3>
<p>Run the validators and read the output before claiming done. "Should pass" is not
"passed" — capture the actual test run, lint output, and diff stat.</p>
<div class="cmds"><code>/superpowers:verification-before-completion</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Commit, push, open a PR</h3>
<p>A single command handles a "what and why" commit, pushes the branch, and opens a PR with a
summary and test plan.</p>
<div class="cmds"><code>/commit-commands:commit-push-pr</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>PR review against the opened PR</h3>
<p>Run the review toolkit against the opened PR for a consolidated review pass. When green and
reviewed, merge.</p>
<div class="cmds"><code>/pr-review-toolkit:review-pr</code> <span class="badge plugin">plugin</span></div>
</div>
</div>

</div>

<div class="pitfall"><strong>Pitfall:</strong> starting to write code before the approach is
settled. If a brainstorm starts producing edits before the plan is written down, that's a
signal to pause and finish the conversation first — code written mid-brainstorm tends to encode
the first idea discussed, not the best one.</div>

<div class="insight"><strong>Insight:</strong> reach for brainstorming when the request is a
goal rather than a spec, when there are multiple viable approaches worth weighing, or when the
work touches feature surface that's unfamiliar in MobileApp. When you already know
roughly what needs to change, skip straight to plan mode instead — brainstorming's whole job is
to get you to that starting point.</div>
