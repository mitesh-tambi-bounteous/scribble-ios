Ingest a URL into this project brain's knowledge wiki, or route a meeting transcript into the meeting-ingest pipeline.

Argument: `$ARGUMENTS` -- a URL, or a path to a meeting transcript (`.vtt` or `.txt`).

All paths are relative to the brain repo root.

---

## Routing (deterministic, first token wins)

1. If `$ARGUMENTS` starts with `http://` or `https://` -> dispatch the `wiki-ingestor` agent with the URL. The agent fetches content, saves a raw snapshot to `knowledge/raw/`, creates wiki pages (source + entity), and updates `knowledge/wiki/index.md` + `knowledge/wiki/log.md`. Stop.
2. If the first token is a path that names an existing file (a meeting transcript, typically `.vtt` or `.txt`) -> delegate to `/ingest-standup` with the path. Do not inline the meeting pipeline here. Stop.

   Multiple transcript paths in one invocation are supported: split on whitespace and route each to `/ingest-standup` independently.
3. Else -> stop with: `unknown route: <first-token>. Expected a URL or a path to a meeting transcript.`

---

## Notes

- URL ingests produce durable wiki knowledge via the `wiki-ingestor` agent.
- Meeting transcripts are project-scoped operational records, not durable wiki knowledge. They are handled by `/ingest-standup`, which writes a digest into `knowledge/meetings/` and extracts suggested action items for a human to promote into `tracking/stories/`. Do not use the `wiki-ingestor` agent for transcripts.
- Run unattended for URL ingests.
