# Abajifar — Cafe & Restaurant Management System

A full-stack Ethiopian cafe and restaurant management system with role-based access control. The application is a modular monolith: Next.js frontend → HTTP API → NestJS backend → PostgreSQL.

## Run & Operate

- **NestJS Backend**: managed Abajifar backend service (port 3001)
- **Next.js Frontend**: managed Abajifar web service — runs `pnpm --filter @workspace/nextjs-app run dev` (PORT injected by artifact routing; previewPath `/`)
- Frontend calls the backend via `/backend/api/*` (not `/api`, which is claimed by the separate API Server artifact); Next.js rewrites `/backend/api/:path*` → `${BACKEND_URL}/api/:path*`
- The Abajifar registration shim runs the real frontend code in `artifacts/nextjs-app/`
- The restaurant backend is `artifacts/nestjs-server/`. `artifacts/api-server/` is not the restaurant application API.

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Zustand
- **Backend**: NestJS 10, TypeORM, Passport JWT
- **Database**: PostgreSQL through TypeORM
- **Auth**: JWT bearer tokens, bcrypt password hashing, role and branch guards
- pnpm workspaces, Node.js, TypeScript

## Where things live

- `artifacts/nestjs-server/` — NestJS API backend
- `artifacts/nextjs-app/` — Next.js frontend
- `artifacts/nestjs-server/src/entities/` — TypeORM entities
- `artifacts/nestjs-server/src/modules/` — Feature modules
- `artifacts/nextjs-app/src/app/` — Next.js pages (App Router)
- `artifacts/nextjs-app/src/lib/api.ts` — API client
- `artifacts/nextjs-app/src/store/auth.ts` — Zustand auth store

## Roles & Accounts

Supported roles are admin, owner, manager, coordinator, waiter, chef, cashier, and storekeeper. Do not publish passwords or reusable credentials in documentation. Provision and rotate production credentials through a controlled administrative process.

## Seed Data

Development seed data can populate Ethiopian sample data:
- Restaurant: CARAVAN Lounge (Addis Abeba)
- 2 branches: Bole & Piassa
- 9 staff with Ethiopian names
- 7 menu categories, 26 Ethiopian dishes
- 23 tables across sections
- 15 inventory items, 5 Ethiopian suppliers

## User preferences

- Ethiopian theme and cultural context throughout
- ETB (Ethiopian Birr) as currency
- Amharic-inspired names for staff and dishes

## Architecture decisions

- Next.js rewrites browser path `/backend/api/*` to backend path `/api/*`.
- NestJS owns business rules, authorization, validation, and all PostgreSQL access.
- TypeORM `synchronize:true` is currently enabled and is a production blocker until migrations and rollback procedures are verified.
- JWT is currently stored in localStorage and injected by the Axios interceptor; treat XSS prevention as a critical security boundary.
- Role-based sidebar rendering (different nav items per role)
- Zustand for auth state with localStorage persistence

## Production status

The codebase is **not yet approved for production deployment**. Required gates include:

- Remove the hard-coded JWT fallback and require production secrets.
- Stop automatic startup password resets and production seeding.
- Disable TypeORM synchronization in production after a tested migration baseline.
- Restrict CORS and production API documentation.
- Add DTO validation and verify branch/restaurant authorization.
- Add repeatable role, order, payment, inventory, report, and export tests.
- Resolve or formally accept security scan findings.
- Verify backup, restore, monitoring, and rollback procedures.

See `docs/12-Production-Readiness-Status.md` for the current evidence matrix.
