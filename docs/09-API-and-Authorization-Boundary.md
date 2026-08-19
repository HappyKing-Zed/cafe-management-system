# API and Authorization Boundary

Updated: August 19, 2026

## Paths

- Browser base: `/backend/api`
- Backend direct base: `/api`
- Backend Swagger: `/api/docs` in development only

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