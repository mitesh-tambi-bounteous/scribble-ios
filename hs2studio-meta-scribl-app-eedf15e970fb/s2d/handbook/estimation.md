# Estimation and Forecasting

How the team sizes work and turns that into a sense of when things land.
Estimation is a team activity: it forces a shared understanding of complexity
before anyone commits to the work.

## What we estimate

- All development work -- stories and tasks -- is estimated. No exceptions.
- Bugs are estimated too; they vary widely in effort.
- Design work is generally not estimated, because its flow is less predictable.

## How we estimate: story points

The team sizes work in story points, a measure of complexity and full effort to
carry an item all the way to done -- not hours.

- Use a Fibonacci-style scale: 0, 1, 2, 3, 5, 8, 13, 21.
- Factor in complexity, risk, and everything the Definition of Done requires,
  not just the coding.
- Break big items down. An 8 should probably be split and re-estimated; a 13 or
  larger must be split before it is pulled in.

## Reference stories

Estimating with a new team is hard until there are anchors. Pick one or two
well-understood items with an obvious size (say a 3) and use them as
benchmarks: is this new item more or less complex than the reference, and
roughly by how much? For scribl, a shipped story such as an early screen or a
data-layer invariant makes a fine reference point.

## How we run the session

- Estimate together, in priority order, during refinement -- not during
  planning. Estimating at planning time is an anti-pattern.
- Poker-style works well: everyone sizes independently, then reveal and discuss
  the gaps. The disagreement is the useful part -- it surfaces hidden
  assumptions and requirement questions.
- Async is fine for a distributed team: size on your own within a set window and
  leave comments, then reconcile.

## Velocity

Velocity is the average number of points the team completes in one iteration --
its throughput.

- A new team starts with an assumed velocity, then switches to actual velocity
  after roughly three iterations.
- Velocity is a planning aid, not a target to game. It tells the team how much
  to commit to and helps forecast when work will land.
- It is relative to this team. Never compare it against another team's.
- It evolves; revisit it every iteration.

## Forecasting

Forecasting turns velocity into predictability, and predictability is what earns
trust -- with stakeholders and within the team. How predictably the team
delivers matters more than how fast.

Given an estimated backlog and a stable velocity:

- Iterations remaining = total remaining backlog points / velocity.
- Calendar time = iterations remaining * iteration length.

Two habits protect the forecast:

- Keep the backlog comprehensive. A forecast is only as honest as the backlog is
  complete -- missing work (setup, migration, hardening, testing) is the usual
  reason dates slip.
- Control mid-iteration scope. Nothing gets added unless something of equal size
  comes out. Uncontrolled exceptions kill commitments and wreck the forecast.

On a POC the numbers are rough and the sample is small, so treat the forecast as
a directional signal: enough to spot when scope is drifting past what the
timeline allows, not a precise delivery date.

_Source: Bounteous Agile Delivery Confluence (space PD). Distilled from: Agile Estimation (id 264465938809123), Scrum Estimation, Velocity & Forecasting (id 264465938940251). Recreated 2026-07-10._
