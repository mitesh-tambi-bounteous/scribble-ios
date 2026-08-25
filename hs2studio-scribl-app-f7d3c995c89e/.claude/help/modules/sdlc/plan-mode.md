# MobileApp · Plan mode

<div class="block-head">
  <div class="kicker">Walkthrough · built-in plan mode</div>
  <h1>Ship a change with plan mode</h1>
  <p class="lede">
    Plan mode is the entry path for well-scoped work: you already know roughly what needs to
    change. Claude explores <strong>read-only</strong> until you approve a plan, then executes it.
    Use this path when the shape of the change is clear; use brainstorming instead when it isn't.
  </p>
  <span class="timing">plan mode → review → approve → implement → review diff → commit</span>
  <div class="legend">
    <span><span class="badge repo">repo</span> shipped in this repo's <code>.claude/</code></span>
    <span><span class="badge plugin">plugin</span> auto-enabled via <code>settings.json</code></span>
    <span><span class="badge builtin">built-in</span> native Claude Code</span>
  </div>
</div>

<div class="steps">

<div class="step plain">
<div>
<h3>Enter plan mode</h3>
<p>Press <code>Shift+Tab</code> to cycle the mode indicator to <strong>plan mode</strong>, or just
describe the task and let Claude propose a plan on its own. In plan mode Claude can read and
explore the codebase but cannot edit files or run state-changing commands until you approve.</p>
<div class="cmds"><code>Shift+Tab → plan mode</code> <span class="badge builtin">built-in</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Describe the task, and ask for a worktree if the repo uses them</h3>
<p>State the goal and any constraints in the plan-mode prompt.
MobileApp uses the standard worktree convention: <code>git worktree add ~/src/MobileApp-wt/&lt;slug&gt;/ -b &lt;slug&gt;</code>.
If MobileApp uses git worktrees to isolate work from the primary checkout, tell Claude
to work in one — it creates the worktree as its first action once the plan is approved, so you
just see a new branch appear. If the repo doesn't use worktrees, this step doesn't apply and
Claude edits in place.</p>
<h4>What to put in your prompt</h4>
<ul>
<li><strong>Goal + ticket</strong> — state the outcome; reference your tracked work item if you use one</li>
<li><strong>Worktree</strong> — tell Claude to work in one; it creates one, you just see a branch</li>
<li><strong>Agent teams</strong> — ask for a task list with dependencies + dispatched agent teams so independent tasks run in parallel</li>
<li><strong>Right-size models</strong> — set each agent's model to its job; use Haiku for validation/check agents (faster, cheaper, more parallel headroom)</li>
<li><strong>"Be brief"</strong> — add the words "be brief" to keep output concise</li>
</ul>
</div>
</div>

<div class="step plain">
<div>
<h3>Review the plan before you approve it</h3>
<p>Read what Claude proposes before exiting plan mode.
<code>/code-review</code> <span class="badge plugin">plugin</span> is available in this repo (from the
enabled <code>code-review</code> plugin) — point it at the plan before approving.
A good plan names the specific files/modules that will change, calls out the sequencing and
dependencies between edits, and states how the result will be verified (tests, manual check, a
specific command). A plan that just restates the request back to you isn't a plan yet — ask for
more specificity before moving on.</p>
</div>
</div>

<div class="step plain">
<div>
<h3>Approve the plan → Claude starts editing</h3>
<p>Approving exits plan mode. Claude leaves read-only mode and begins making the changes it
described. Watch the diff as it goes; interrupt if it drifts off the approved scope.</p>
<div class="cmds"><code>ExitPlanMode</code> <span class="badge builtin">built-in</span></div>
</div>
</div>

<div class="step plain">
<div>
<h3>Review the diff before committing</h3>
<p>Once edits are done, review the working-tree diff for anything that doesn't trace back to
the approved plan — drive-by cleanup, scope creep into unrelated files, or missed pieces. A
manual read of <code>git diff</code> before staging is enough for smaller changes.</p>
</div>
</div>

<div class="step plain">
<div>
<h3>Commit with a clear message</h3>
<p>Write a commit message that explains <em>why</em> the change was made, not just what
changed — the diff already shows what. Keep one conceptual change per commit where practical.
The safety hooks configured under <code>.claude/</code>, if any, run automatically on the
commit — you don't have to invoke them, just don't bypass them.</p>
<div class="cmds"><code>git commit -m "..."</code> <span class="badge builtin">built-in</span></div>
</div>
</div>

</div>

<div class="pitfall"><strong>Pitfall:</strong> approving a vague plan just to get to the "fun
part" of watching code get written. If you can't point to the specific files that will change,
the plan isn't ready — push back before you approve, and don't skip the diff review before
committing just because the plan looked solid.</div>

<div class="insight"><strong>Insight:</strong> plan mode assumes you already know roughly what
needs to change and just want the approach checked before it happens. When the task is a goal
rather than a spec, or there are real design tradeoffs to weigh first, start with brainstorming
instead — it's meant to converge on a plan, which you then run through this same review and
execute path.</div>
