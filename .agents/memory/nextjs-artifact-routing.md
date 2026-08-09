---
name: Next.js/NestJS routing in this workspace
description: How the non-standard Next.js frontend + NestJS backend are routed through the application router
---

The workspace uses the application router (`router = "application"`); only registered artifacts get preview routing. `[[ports]]` mappings in `.replit` do NOT make a plain workflow reachable in the preview.

**Setup that works:** the `artifacts/habesha` artifact (created as react-vite, then repointed via `verifyAndReplaceArtifactToml`) runs `pnpm --filter @workspace/nextjs-app run dev` at previewPath `/`. The actual code lives in `artifacts/nextjs-app/` (Next.js) and `artifacts/nestjs-server/` (NestJS, port 3001, plain workflow "NestJS Backend").

**Why:** `createArtifact` refuses existing dirs and `verifyAndReplaceArtifactToml` can't create a toml from scratch, so a shim artifact whose service command points at the real package is the only path. The `artifacts/habesha/src` Vite scaffold is unused.

**How to apply:**
- Frontend must call the backend via `/backend/api/*` — `/api` is claimed by the (unused) api-server artifact. Next.js rewrites `/backend/api/:path*` → `localhost:3001/api/:path*` (next.config.js).
- Next dev needs `-H 0.0.0.0` and `allowedDevOrigins` (package.json dev script + next.config.js).
- Restart the frontend with workflow name `artifacts/habesha: web` (injects PORT=25335); backend is the second service `artifacts/habesha: backend` (PORT=3001) so it also runs in production deployments — a plain workflow would not, and login would fail with ECONNREFUSED in prod.
- Never run `next build` while the dev server is up — they share `.next/` and it corrupts the dev bundle (module-not-found/webpack `call` errors) until recompile/restart.
