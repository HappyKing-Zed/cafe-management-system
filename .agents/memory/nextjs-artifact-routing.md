---
name: Browser-to-backend routing
description: Durable browser API prefix constraint for the restaurant app
---

Browser requests must keep the `/backend/api/*` prefix; `/api/*` belongs to a separate artifact in this workspace.

**Why:** Reusing `/api/*` for the restaurant backend sends browser traffic to the wrong service.

**How to apply:** Preserve the browser-facing `/backend/api/*` contract when changing frontend API clients or routing. Keep development/build output isolation guidance in its dedicated memory topic.
