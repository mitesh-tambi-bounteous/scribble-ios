---
description: Open and answer questions from this repo's cheat-sheet help doc.
---

1. **Offer to open the cheat-sheet** (offer, don't force). Suggest running:

   ```bash
   python3 -c "import os, webbrowser; webbrowser.open('file://' + os.path.abspath('.claude/help/cheat-sheet.html'))"
   ```

2. **Load live context** by referencing every standard module — this keeps your answers and
   the rendered HTML in sync:

   @.claude/help/modules/quickref.md
   @.claude/help/modules/sdlc/plan-mode.md
   @.claude/help/modules/sdlc/brainstorm.md
   @.claude/help/modules/setup.md
   @.claude/help/modules/concepts.md
   @.claude/help/modules/terminal.md

3. **If invoked as `/arc-help <topic>`:** read `.claude/help/cheatsheet.yaml`, match
   `<topic>` against a tab or sub id/label. Answer directly from that module's already-loaded
   content, then print a deep-link:
   - Top-level tab: `file://<abs-path-to-cheat-sheet.html>#tab-<id>`
   - Sub-paged tab: `file://<abs-path-to-cheat-sheet.html>#sub-<tab>-<sub>`

4. **If invoked with no arguments:** ask where the user is / what they need — one short
   sentence plus the tab labels from `cheatsheet.yaml`. Route to the matching module and
   state the single next concrete action.

Be terse. No preamble, no recap of these instructions to the user — just do them.
