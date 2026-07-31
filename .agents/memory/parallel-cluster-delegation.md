---
name: Parallel cluster delegation for Mineral
description: How the big Task C/C.1 pass was split across subagents without file conflicts.
---

Rule: for multi-spec passes, split by FILE OWNERSHIP clusters (origin map / encounter flow / notes+capture / onboarding+auth), land shared foundations (types, shared component props, firestore fields) yourself BEFORE dispatch, and keep cross-cluster contracts explicit (e.g. AuthSheet props API dictated in both producer's and consumer's task text).

**Why:** four general subagents ran fully parallel with zero merge conflicts; the one review failure came from an instruction of mine that contradicted the spec (spec text wins — quote it, don't paraphrase, in task prompts).

**How to apply:** append-only rights for shared libs (lib/firestore.ts), copy strings passed verbatim, each subagent runs tsc and reports out-of-scope errors instead of fixing them.
