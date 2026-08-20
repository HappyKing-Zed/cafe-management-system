---
name: Next.js build and dev output race
description: How to verify production builds without a running Next dev server corrupting or racing the shared output directory.
---

Do not treat a production-build failure as reproducible while `next dev` is simultaneously using the same application directory. Stop the dev workflow or run the production build from an isolated copy with the locked dependencies.

**Why:** Next.js development and production commands both write to `.next`. Concurrent use can produce transient missing-module/page-data errors even when a clean production build is valid.

**How to apply:** For release verification, use a frozen install and an isolated source copy (or stop the managed web workflow), then require all pages to compile and generate successfully.