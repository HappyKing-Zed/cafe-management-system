# Environment and Secrets

Updated: August 19, 2026

## Rules

- Store real secrets only in Replit Secrets or the target platform's secret manager.
- Never commit database passwords, JWT secrets, account passwords, tokens, or production URLs containing credentials.
- `.env.example` contains names and safe placeholders only.
- Runtime-managed PostgreSQL variables must not be manually duplicated.
- Production must fail safely when a required secret is missing; it must not use a known fallback.

## Variable ownership

| Variable | Layer | Secret? | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection |
| `JWT_SECRET` | Backend | Yes | JWT signing and verification |
| `PORT` | Frontend/backend | No | Platform-provided listen port |
| `BACKEND_URL` | Next.js server | No | Target for `/backend/api` rewrite |
| `CORS_ORIGIN` | Backend | No | Allowed production frontend origin |
| `NODE_ENV` | Both | No | Development/production behavior |

Do not expose `DATABASE_URL` or `JWT_SECRET` through variables prefixed with `NEXT_PUBLIC_`.

## Production requirements

1. Require `DATABASE_URL` and `JWT_SECRET`.
2. Use a long random JWT secret and define a rotation procedure.
3. Restrict CORS to approved frontend origins.
4. Disable or protect Swagger and development seed operations.
5. Separate production account provisioning from normal startup.
6. Verify that logs and error responses do not print secrets or connection strings.

## Rotation procedure

For a compromised JWT secret, create a new secret in the secret manager, restart the backend, require users to sign in again, and review authentication logs. Never place the old or new value in documentation or chat.