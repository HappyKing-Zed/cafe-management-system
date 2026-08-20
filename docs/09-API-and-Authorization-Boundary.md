# API and Authorization Boundary

Updated: August 20, 2026

## Layer ownership

The application remains a modular monolith with one web interface, one authoritative restaurant API, and one PostgreSQL database.

1. **Next.js pages and components** own presentation, user interaction, and screen state.
2. **Domain API clients** in `artifacts/nextjs-app/src/lib/api/` own endpoint declarations for authentication, organization, catalog, orders, notifications, payments, inventory, reporting, and administration.
3. **The HTTP client** in `api/http-client.ts` owns Axios configuration, bearer-token attachment, and expired-session handling. Domain clients do not create their own transports.
4. **The compatibility facade** in `src/lib/api.ts` re-exports the same functions and raw Axios response contracts used by existing screens.
5. **The Next.js rewrite** owns server-to-server forwarding. `api-paths.json` is the single source for the browser base and backend prefix used by both the HTTP client and `next.config.js`.
6. **NestJS controllers** own HTTP routing, guards, request extraction, and response boundaries.
7. **NestJS services** own business rules and repository operations. Controllers do not connect to PostgreSQL directly.
8. **Feature modules** own their TypeORM repositories through `TypeOrmModule.forFeature`.
9. **The database boundary** in `artifacts/nestjs-server/src/database/` owns the root TypeORM connection options and complete entity registry.

Dependency direction is one way: presentation → domain client → HTTP transport → rewrite → controller → service → TypeORM repository → PostgreSQL.

## Paths

- Browser base: `/backend/api`
- Backend direct base: `/api`
- Backend Swagger: `/api/docs` in development only

These path values and the frontend-to-backend rewrite contract are unchanged by the layer separation.

## Authentication

Login accepts email and password. Passwords are compared with bcrypt hashes. Successful login returns a JWT bearer token. Protected requests send `Authorization: Bearer <token>`.

The current browser stores the token in localStorage. This makes XSS prevention important. A future cookie/session migration is a separate security project and must not be mixed into a routine refactor.

## Authorization

Frontend navigation improves usability but is not a security control. NestJS guards, role checks, and branch/restaurant scoping are authoritative.

Every read or write involving branch-owned data must answer:

1. Is the requester authenticated?
2. Is the role allowed to perform this action?
3. Is the requested restaurant/branch in scope?
4. Are referenced users, tables, orders, inventory items, and payments in the same scope?

## API contract rules

- Preserve existing endpoint paths unless a coordinated migration is approved.
- Use the correct HTTP method for the operation.
- Validate request bodies through DTOs at the controller boundary.
- Reject unknown or disallowed fields on sensitive updates.
- Return stable JSON errors with suitable status codes.
- Do not return stack traces, SQL errors, password hashes, tokens, or internal connection details.
- Use transactions for multi-write order, payment, table, purchase-order, and stock workflows.

## High-priority review areas

- Unrestricted object updates in users, branches, restaurants, menus, and tables
- Single-record branch and restaurant scoping
- Order status races and cross-branch references
- Payment/table updates that are not atomic
- Production access to Swagger and seed operations
- Login throttling and security headers