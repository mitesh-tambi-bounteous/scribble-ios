#!/usr/bin/env python3
"""Claude Code status line — Bounteous branded.

Cross-platform port of statusline.sh. Reads the Claude Code status JSON
payload from stdin and prints a single line of ANSI-coloured text to
stdout. Works on macOS Terminal/iTerm2, Linux terminals, Windows Terminal,
and the VS Code integrated terminal — all support 24-bit ANSI.

Brand palette (BNT_Visual_Identity_Internal_Guide_Feb2025.pdf, p.6):
  #8EE7FF cyan, #F861C3 hot-pink, #B61CA7 magenta, #E6F0F0 soft-white,
  #0D016B deep-purple.
"""
import json
import os
import pathlib
import re
import subprocess
import sys


def c(r: int, g: int, b: int) -> str:
    return f"\x1b[38;2;{r};{g};{b}m"


RESET = "\x1b[0m"
PIPE = c(12, 102, 147) + "|" + RESET
COL_CWD = c(230, 240, 240)
COL_BRANCH = c(248, 97, 195)
COL_WORKTREE = c(182, 28, 167)
COL_MODEL = c(142, 231, 255)
COL_CTX_OK = c(142, 231, 255)
COL_CTX_WARN = c(182, 28, 167)
COL_CTX_CRIT = c(248, 97, 195)


def normalize_model(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r"^[Cc]laude[-_]", "", name)
    for fam in ("opus", "sonnet", "haiku"):
        name = re.sub(
            rf"{fam}[-_](\d+)[-_](\d+).*",
            lambda m: f"{fam.title()} {m.group(1)}.{m.group(2)}",
            name,
            flags=re.IGNORECASE,
        )
    return name


def fmt_tokens(n: int) -> str:
    return f"{n // 1000}k" if n >= 1000 else str(n)


def parse_payload(raw: str):
    try:
        d = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return "", "", 0

    m = d.get("model") or {}
    if isinstance(m, dict):
        model = normalize_model(m.get("display_name") or m.get("name") or "")
    elif isinstance(m, str):
        model = normalize_model(m)
    else:
        model = ""

    cw = d.get("context_window") or {}
    used = cw.get("total_input_tokens")
    total = cw.get("context_window_size")
    pct_raw = cw.get("used_percentage")

    ctx, pct = "", 0
    if used is not None and total is not None and int(total) > 0:
        u, t = int(used), int(total)
        pct = int(pct_raw) if pct_raw is not None else int(round(u / t * 100))
        ctx = f"{fmt_tokens(u)}/{fmt_tokens(t)} ({pct}%)"
    elif pct_raw is not None:
        pct = int(round(float(pct_raw)))
        ctx = f"{pct}%"

    return model, ctx, pct


def git(*args: str, cwd: str | None = None) -> str:
    try:
        r = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            timeout=3,
            cwd=cwd,
        )
        if r.returncode != 0:
            return ""
        return r.stdout.strip()
    except Exception:
        return ""


def home_relative(path: str) -> str:
    try:
        home = str(pathlib.Path.home())
        if path.startswith(home):
            return "~" + path[len(home):]
    except Exception:
        pass
    return path


def main() -> int:
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    model, ctx, ctx_pct = parse_payload(raw)

    if ctx_pct >= 90:
        ctx_color = COL_CTX_CRIT
    elif ctx_pct >= 70:
        ctx_color = COL_CTX_WARN
    else:
        ctx_color = COL_CTX_OK

    cwd = home_relative(os.getcwd()).replace("\\", "/")
    branch = git("rev-parse", "--abbrev-ref", "HEAD")

    git_dir = git("rev-parse", "--git-dir")
    git_common = git("rev-parse", "--git-common-dir")
    toplevel = git("rev-parse", "--show-toplevel")

    worktree_name = ""
    if git_dir and git_common and git_dir != git_common and toplevel:
        worktree_name = os.path.basename(toplevel)

    wt_mark = ""
    if toplevel:
        # Normalise to forward-slash for the substring check; matches "-wt/" on
        # Mac/Linux and "-wt\\" / "-wt/" on Windows.
        norm = toplevel.replace("\\", "/")
        wt_mark = "🌿" if "-wt/" in norm else "⚠️ "

    parts = [PIPE]
    if wt_mark:
        parts.append(wt_mark)
    parts.append(f"{COL_CWD}{cwd}{RESET}")
    if branch:
        parts.extend([PIPE, f"{COL_BRANCH}{branch}{RESET}"])
    if worktree_name:
        parts.extend([PIPE, f"{COL_WORKTREE}wt: {worktree_name}{RESET}"])
    if model:
        parts.extend([PIPE, f"{COL_MODEL}{model}{RESET}"])
    if ctx:
        parts.extend([PIPE, f"{ctx_color}ctx: {ctx}{RESET}"])
    parts.append(PIPE)

    sys.stdout.write(" ".join(parts) + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # Statusline must never block; print a minimal fallback.
        sys.stdout.write("|\n")
        sys.exit(0)
