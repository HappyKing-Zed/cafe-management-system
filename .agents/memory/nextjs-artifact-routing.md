---
name: Next.js/NestJS routing in this workspace
description: How the non-standard Next.js frontend + NestJS backend are routed through the application router
---

The workspace uses the application router (`router = "application"`); only registered artifacts get preview routing. `[[ports]]` mappings in `.replit` do NOT make a plain workflow reachable in the preview.

**Setup that works:** the registered Abajiraf artifact (created as react-vite, then repointed through validated artifact configuration) runs the Next.js package at previewPath `/`. The actual code lives in the Next.js and NestJS packages.

**Why:** artifact creation refuses existing directories and validated replacement cannot create registration from scratch, so a shim artifact whose service command points at the real package is required. The shim's Vite scaffold is unused.

**How to apply:**
- Frontend must call the backend via `/backend/api/*` — `/api` is claimed by the (unused) api-server artifact. Next.js rewrites `/backend/api/:path*` → `localhost:3001/api/:path*` (next.config.js).
- Next dev needs `-H 0.0.0.0` and `allowedDevOrigins` (package.json dev script + next.config.js).
- Restart the frontend and backend using the two managed services owned by the registered Abajiraf artifact. The backend must remain a second artifact service so production deployments include it.
- Never run `next build` while the dev server is up — they share `.next/` and it corrupts the dev bundle (module-not-found/webpack `call`/routes-manifest ENOENT errors). The development startup deliberately removes `.next` before launching Next.js so restarts recover automatically. This applies to review/verification subagents too — tell them explicitly not to run `next build`. (Publishing is safe: deployment builds run in a separate environment.)
