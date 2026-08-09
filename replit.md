# Habesha Kuliner — Cafe & Restaurant Management System

A full-stack Ethiopian cafe and restaurant management system with role-based access control.

## Run & Operate

- **NestJS Backend**: `pnpm --filter @workspace/nestjs-server run dev` (port 3001)
- **Next.js Frontend**: `pnpm --filter @workspace/nextjs-app run dev` (port 3000)
- Frontend proxies `/api/*` to backend at `localhost:3001`

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Zustand
- **Backend**: NestJS 10, TypeORM, Passport JWT
- **Database**: PostgreSQL (TypeORM with synchronize: true in dev)
- **Auth**: JWT bearer tokens, role-based guards
- pnpm workspaces, Node.js, TypeScript

## Where things live

- `artifacts/nestjs-server/` — NestJS API backend
- `artifacts/nextjs-app/` — Next.js frontend
- `artifacts/nestjs-server/src/entities/` — TypeORM entities
- `artifacts/nestjs-server/src/modules/` — Feature modules
- `artifacts/nextjs-app/src/app/` — Next.js pages (App Router)
- `artifacts/nextjs-app/src/lib/api.ts` — API client
- `artifacts/nextjs-app/src/store/auth.ts` — Zustand auth store

## Roles & Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@habesha.com | admin123 |
| Owner | owner@habesha.com | owner123 |
| Manager | manager@habesha.com | manager123 |
| Coordinator | coordinator@habesha.com | coord123 |
| Waiter | waiter1@habesha.com | waiter123 |
| Chef | chef@habesha.com | chef123 |
| Cashier | cashier@habesha.com | cashier123 |
| Storekeeper | storekeeper@habesha.com | store123 |

## Seed Data

Click "Seed Data" on the dashboard to populate with Ethiopian sample data:
- Restaurant: Habesha Kuliner (Addis Abeba)
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

- TypeORM synchronize:true for dev (auto-creates tables)
- Next.js rewrites `/api/*` to NestJS backend (no CORS needed from browser)
- JWT stored in localStorage, injected by axios interceptor
- Role-based sidebar rendering (different nav items per role)
- Zustand for auth state with localStorage persistence
