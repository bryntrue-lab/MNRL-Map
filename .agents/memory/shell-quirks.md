---
name: Shell quirks in this workspace
description: Container shell behaviors that have burned a session before.
---

**Rule:** Never `pkill -f "<pattern>"` where the pattern appears verbatim in your own command text — ShellExec runs `bash -c "<entire command>"`, so the bash process's own cmdline matches and pkill kills your shell mid-script (exit −1, no output, later parts of the command never run — including heredoc file writes).

**Why:** 2026-07-27: `pkill -f "firebase deploy"` inside a longer script killed the script itself; a storage-rules probe file silently never got written.

**How to apply:** Use a character-class to break self-matching: `pkill -f "deploy --only functi[o]ns"` matches the target process but not the literal pattern in your own cmdline. Same trick for `pgrep`.

## nohup does not outlive the ShellExec call

**Rule:** Backgrounded processes (`nohup ... &`) are killed when their ShellExec call returns — a long deploy started in the background and "polled" from later calls will silently die mid-flight (observed 2026-07-27: firebase deploy died after its parent call ended, leaving half-created FAILED cloud functions).

**How to apply:** Run long jobs in the foreground of a single call sized to the 300s cap. If a job can exceed that, prefer operations that continue server-side (cloud LROs) and poll their status via API from fresh calls — never rely on a surviving local process.
