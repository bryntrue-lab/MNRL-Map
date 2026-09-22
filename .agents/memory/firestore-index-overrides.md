---
name: Firestore index override preservation
description: Single-field overrides replace inherited collection indexes and can break client queries.
---
When adding a collection-group single-field index, explicitly preserve the normal collection-scope ascending and descending indexes for that field.

**Why:** Adding group-only overrides for analytics removed inherited collection indexes. The founder's createdAt-descending Notes query failed with FAILED_PRECONDITION while Admin counts still showed all notes, producing apparent data loss and empty downstream gates. A deploy without deletion warnings did not detect this replacement.

**How to apply:** Inspect all scopes in fieldOverrides, test normal client queries as well as analytics queries against the live backend, and wait for READY before declaring success. Owner-authenticated metadata projections can confirm rules and ordered-query behavior without reading private note text.