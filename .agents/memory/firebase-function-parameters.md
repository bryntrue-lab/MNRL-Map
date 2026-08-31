---
name: Firebase function parameters
description: Noninteractive deployment behavior for Firebase defineString parameters.
---

For noninteractive Firebase Functions deploys, provide `defineString` parameter
values through the project-scoped dotenv file Firebase expects in the functions
directory. Exporting the same value in the deploy command's shell environment
does not satisfy Firebase CLI parameter discovery.

**Why:** A deploy with the value exported in the process environment still
stopped with “no value” for the parameter. The same deploy succeeded when a
temporary project dotenv was present.

**How to apply:** Create the dotenv only for the deploy, never commit sensitive
values, and remove the temporary file immediately after the command completes.