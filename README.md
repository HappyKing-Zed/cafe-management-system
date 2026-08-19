# Jima Aba Jifar

Jima Aba Jifar is an Ethiopian cafe and restaurant management system built as a modular monolith.

## Architecture

```text
User
  ↓
Next.js 15 / React 19 frontend
  ↓  /backend/api/*
NestJS 10 REST API
  ↓  TypeORM
PostgreSQL
```

- Registered web artifact: `artifacts/habesha`
- Real frontend source: `artifacts/nextjs-app`
- Authoritative restaurant backend: `artifacts/nestjs-server`
- Browser API base: `/backend/api`
- Backend API prefix: `/api`
- `artifacts/api-server` is a separate minimal artifact and is not the restaurant API.

## Development

Use the managed workflows:

- `artifacts/habesha: web`
- `artifacts/habesha: backend`

Do not run a Next.js production build while its development server is running because both processes share `.next`.

## Documentation

1. `docs/01-FRS-Functional-Requirements.html`
2. `docs/02-SRS-Software-Requirements.html`
3. `docs/03-SDD-Software-Design.html`
4. `docs/04-User-Manual.html`
5. `docs/05-Handoff-and-Deployment-Requirements.html`
6. `docs/06-Deploy-on-Vercel.html`
7. `docs/07-Architecture-and-Routing.md`
8. `docs/08-Environment-and-Secrets.md`
9. `docs/09-API-and-Authorization-Boundary.md`
10. `docs/10-Database-Safety-Runbook.md`
11. `docs/11-Test-and-Release-Runbook.md`
12. `docs/12-Production-Readiness-Status.md`

## Production status

Production deployment is currently **BLOCKED** until the mandatory security, migration, backup/restore, automated-test, and release-verification controls in document 12 are complete. Documentation must not be treated as evidence that a control has been implemented.