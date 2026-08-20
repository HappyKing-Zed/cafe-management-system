# Environment and Secrets

Updated: August 20, 2026

## Rules

- Store real secrets only in Replit Secrets or the target platform's secret manager.
- Never commit database passwords, JWT secrets, account passwords, tokens, or production URLs containing credentials.
- The root and artifact-specific `.env.example` files contain names and safe placeholders only.
- Runtime-managed PostgreSQL variables must not be manually duplicated.
- Production must fail safely when a required secret is missing; it must not use a known fallback.

## Variable ownership

| Variable | Layer | Secret? | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection |
| `JWT_SECRET` | Backend | Yes | JWT signing and verification |
| `PORT` | Frontend/backend | No | Platform-provided listen port for each managed workflow |
| `BACKEND_URL` | Next.js server | No | Target for `/backend/api` rewrite |
| `REPLIT_DEV_DOMAIN` | Next.js development server | No | Platform-provided preview host used by `allowedDevOrigins` |
| `NODE_ENV` | Both | No | Development/production behavior |

Do not expose `DATABASE_URL` or `JWT_SECRET` through variables prefixed with `NEXT_PUBLIC_`.

## Example file ownership

- `artifacts/nextjs-app/.env.example` documents only Next.js server settings. The browser API path is code-owned and is not configurable from client JavaScript.
- `artifacts/nestjs-server/.env.example` documents only NestJS, authentication, and PostgreSQL settings.
- The root `.env.example` is a workspace overview for operators, not a shared runtime file for both workflows.

`CORS_ORIGIN` is intentionally not listed as active configuration because the current backend does not read it. CORS policy changes are tracked separately and are outside this boundary refactor.

## Production requirements

1. Require `DATABASE_URL` and `JWT_SECRET`.
2. Use a long random JWT secret and define a rotation procedure.
3. Restrict CORS to approved frontend origins.
4. Disable or protect Swagger and development seed operations.
5. Separate production account provisioning from normal startup.
6. Verify that logs and error responses do not print secrets or connection strings.

## Rotation procedure

For a compromised JWT secret, create a new secret in the secret manager, restart the backend, require users to sign in again, and review authentication logs. Never place the old or new value in documentation or chat.