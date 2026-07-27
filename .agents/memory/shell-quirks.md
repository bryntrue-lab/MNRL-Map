---
name: Shell quirks in this workspace
description: Container shell behaviors that have burned a session before.
---

**Rule:** Never `pkill -f "<pattern>"` where the pattern appears verbatim in your own command text — ShellExec runs `bash -c "<entire command>"`, so the bash process's own cmdline matches and pkill kills your shell mid-script (exit −1, no output, later parts of the command never run — including heredoc file writes).

**Why:** 2026-07-27: `pkill -f "firebase deploy"` inside a longer script killed the script itself; a storage-rules probe file silently never got written.

**How to apply:** Use a character-class to break self-matching: `pkill -f "deploy --only functi[o]ns"` matches the target process but not the literal pattern in your own cmdline. Same trick for `pgrep`.
