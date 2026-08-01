---
name: Web e2e limits for Mineral
description: What the Playwright web tester can and cannot verify, and how to phrase instructions.
---

- Tester has no fake-mic flags; voice = quiet type-fallback on web. Verify the audio pipeline server-side (admin SDK) and rules via REST probes.
- Firestore web-channel `Write/channel` requests often report as "failed" network entries while writes land fine — confirm via UI feed or admin query, not the network tab.
- Gesture-handler taps on canvas/SVG zones are flaky for the tester: give exact data-testids and explain what each control does (e.g. the Origin TODAY chip is a swing-home control active only while wandering; the reading sheet opens by quick-clicking empty spiral-zone area). Wrong-affordance instructions produce false "bug" reports.
- Subtle RNW styling (opacity/brightness highlights) is unverifiable by tester screenshots or DOM color checks (they hit wrapper nodes). Verify state via localStorage keys instead; trust code for the visual.
- Admin-side checks: run node via ShellExec from `functions/` (node is NOT on PATH inside the CodeExecution impure sandbox). collectionGroup queries on fieldNotes need composite indexes — iterate users' subcollections instead.
