---
name: Reading recovery and quote trust
description: Legacy model-output repair must preserve prose and validate serif claims.
---
Limit legacy JSON unwrapping to the known single-paragraph, single-span envelope with no outer question. Do not interpret arbitrary JSON-looking prose inside an otherwise valid reading.

**Why:** Broad nested detection can discard surrounding prose and the outer question. An existing malformed reading required controlled recovery of unescaped quotes, not just JSON.parse. Read-only comparison verified all recovered span text was preserved.

**How to apply:** Validate model response schemas atomically before saving; never silently filter away malformed spans. Keep synthetic regression fixtures rather than private reading text.

Recovered quote flags are untrusted until the complete span matches an exact substring of a source note.

**Why:** The existing malformed reading's quote candidates were not exact note substrings. Serif acceptance cannot be achieved by preserving incorrect model flags.

**How to apply:** Downgrade unsupported quotes, preserve their prose, and report the limitation rather than inventing or rewriting quoted language.

Use schema-enforced structured output, not JSON syntax mode alone; a top-level paragraphs array is not sufficient proof of success.

**Why:** A live model response put the question inside a fourth paragraph and omitted quote booleans. JSON syntax mode allowed this, and the fallback embedded the whole JSON response in a text span. Strict schema generation plus nested-envelope recovery is required.

**How to apply:** Verify nested span fields and zero embedded JSON on fresh generation, compare deployed source when debugging, and log parse outcome metadata only. Recovery must account for the entire payload: an older truncated response had substantial unaccounted trailing content, so extracting three recognizable spans would silently discard data.