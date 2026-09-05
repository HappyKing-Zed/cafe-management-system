# Jima — CARAVAN Lounge
## Render Deployment Guide

**Application owner:** CARAVAN Lounge  
**Technology provider:** Idata Technologies  
**Architecture:** Next.js frontend, NestJS backend, PostgreSQL database  
**Deployment target:** Render  
**Last reviewed:** September 5, 2026

---

## 1. Deployment architecture

Create three resources in one Render region:

1. **Render Postgres** — production database.
2. **Backend Web Service** — NestJS API from `artifacts/nestjs-server`.
3. **Frontend Web Service** — Next.js application from `artifacts/nextjs-app`.

Keep both web services and PostgreSQL in the same region. The backend should use
the database's **internal URL**. The frontend communicates with the backend
through its own `/backend/api` proxy, so browser traffic remains same-origin.

Do not deploy `artifacts/api-server` or the placeholder Habesha shell. They are
not the Jima production services.

---

## 2. Before deployment

### Required accounts and access

- A Render account.
- A GitHub, GitLab, or Bitbucket repository containing the complete workspace.
- Permission to create two web services and one PostgreSQL database.
- A strong production JWT secret.
- A **live** ShegerPay API key if genuine payment verification is required.

### Repository requirements

The repository must include:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `artifacts/nextjs-app`
- `artifacts/nestjs-server`

Commit and push the intended production version before creating the services.
Never commit environment-variable values or API keys.

---

## 3. Create the PostgreSQL database

1. Open the Render Dashboard.
2. Select **New → PostgreSQL**.
3. Name the database, for example `jima-production-db`.
4. Select the same region that will be used for both web services.
5. Select the required database plan.
6. Create the database.
7. Open the database's **Connect** section.
8. Copy the **Internal Database URL** for use in the backend service.

Use the internal URL only inside Render. Keep the external URL restricted to
approved administration and backup operations.

### Migration warning

The NestJS backend automatically runs its registered TypeORM migrations when it
starts in production. Before the first production deployment:

1. Take a database backup if importing an existing Jima database.
2. Deploy to a staging database first.
3. Review the backend logs and confirm every migration succeeds.
4. Do not set `DATABASE_SYNCHRONIZE=true` in production.

---

## 4. Create the NestJS backend service

1. Select **New → Web Service**.
2. Connect the Jima repository.
3. Use these settings:

| Render field | Value |
|---|---|
| Name | `jima-backend` or another unique name |
| Region | Same region as PostgreSQL |
| Branch | Production branch |
| Language | Node |
| Root Directory | Leave blank |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/nestjs-server run build` |
| Start Command | `pnpm --filter @workspace/nestjs-server run start` |
| Health Check Path | `/nestjs-backend` |

The root directory must remain the repository root because Jima is a pnpm
workspace and its dependencies are resolved from the workspace lockfile.

### Backend environment variables

Add these under **Environment**:

| Variable | Required | Setting |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Render Postgres internal URL |
| `JWT_SECRET` | Yes | Strong randomly generated secret |
| `SHEGERPAY_API_KEY` | For electronic verification | ShegerPay live API key |
| `SESSION_SECRET` | Optional compatibility | Separate strong random secret |
| `DATABASE_SYNCHRONIZE` | No | Omit it or set it to `false` |

Do not manually define `PORT`. Render supplies it automatically. The backend
already listens on Render's `PORT` and binds to `0.0.0.0`.

### Deploy and verify the backend

1. Create the service and wait for the deployment to finish.
2. Confirm the logs contain:
   - `Found 0 errors`
   - `Nest application successfully started`
   - A successful migration result with no database errors
3. Open:
   - `https://YOUR-BACKEND.onrender.com/nestjs-backend`
4. Confirm the response reports `status: ok`.
5. Record the backend's public HTTPS URL. It is required by the frontend.

Do not add `/api` to the saved backend URL.

---

## 5. Create the Next.js frontend service

1. Select **New → Web Service**.
2. Connect the same Jima repository.
3. Use these settings:

| Render field | Value |
|---|---|
| Name | `jima-frontend` or another unique name |
| Region | Same region as backend and PostgreSQL |
| Branch | Production branch |
| Language | Node |
| Root Directory | Leave blank |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/nextjs-app run build` |
| Start Command | `pnpm --filter @workspace/nextjs-app exec next start -H 0.0.0.0 -p $PORT` |
| Health Check Path | `/login` |

### Frontend environment variables

| Variable | Required | Setting |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `BACKEND_URL` | Yes | Backend public HTTPS URL, without `/api` |

Example format:

```text
BACKEND_URL=https://YOUR-BACKEND.onrender.com
```

Do not use `localhost`, a Replit development domain, or a URL ending in `/api`.
Do not manually define `PORT`.

### Deploy and verify the frontend

1. Create the frontend service.
2. Wait for `next build` and `next start` to complete.
3. Open the frontend's Render URL.
4. Confirm the Jima login page loads.
5. Sign in with an authorized production account.
6. Confirm authenticated API requests work without `502`, CORS, or network
   errors.

---

## 6. Production acceptance checklist

Complete these checks before staff begin using the Render deployment.

### Access and permissions

- [ ] Admin, owner, manager, coordinator, waiter, cashier, kitchen, and store
      roles reach only their permitted screens.
- [ ] A staff member set to OFF cannot sign in or continue an existing session.
- [ ] Production account passwords are not shared or left at temporary values.

### Orders and kitchen

- [ ] Create a dine-in order.
- [ ] Create a takeaway order with the required customer phone number.
- [ ] Assign kitchen items and progress them to Ready to Serve.
- [ ] Mark all items Served and confirm the dine-in table becomes Available.
- [ ] Confirm paying an older order does not release a newly occupied table.

### Payments

- [ ] Cash payment confirmation works.
- [ ] Partial item settlement works.
- [ ] A reused transaction ID is rejected.
- [ ] ShegerPay genuine verification succeeds only with a live key.
- [ ] A ShegerPay test-key simulation does not settle an order.

### Inventory and reporting

- [ ] Branch requests, management approval, and Main Store fulfillment work.
- [ ] Inventory changes only during fulfillment.
- [ ] Summary & Reports filters work.
- [ ] PDF and Excel exports download successfully.
- [ ] Sales exports include waiter, order sold type, payment type, and full
      permitted details.

---

## 7. Security and operations

Before public production use:

1. Restrict backend CORS from the current wildcard configuration to the final
   frontend domain if direct cross-origin API access is not required.
2. Decide whether Swagger documentation at `/api/docs` should remain publicly
   reachable.
3. Review automatic startup account provisioning and ensure it cannot reset or
   expose production credentials.
4. Enable the appropriate Render PostgreSQL backup and recovery plan.
5. Configure service notifications for failed deploys and unhealthy services.
6. Rotate any credential that was previously pasted into chat, logs, source
   code, or an issue tracker.
7. Keep `JWT_SECRET`, `SESSION_SECRET`, `DATABASE_URL`, and
   `SHEGERPAY_API_KEY` only in Render's secret environment-variable storage.

The current application uses bearer tokens stored by the browser, not
cookie-based sessions.

---

## 8. Automatic deployments

For each web service:

1. Enable auto-deploy from the production branch only after the first manual
   deployment succeeds.
2. Prefer **After CI Checks Pass** when the repository has CI checks.
3. Otherwise use **On Commit**.
4. Add Render build filters so backend-only changes do not unnecessarily
   redeploy the frontend and frontend-only changes do not redeploy the backend.

Keep workspace configuration and shared-library changes in both services'
watched paths.

---

## 9. Rollback procedure

If a deployment fails:

1. Do not repeatedly restart a backend that is failing during a migration.
2. Save the backend and database error logs.
3. In Render, redeploy the last known-good commit or use the available rollback
   option for the service.
4. If a migration changed production data or schema, restore from the approved
   backup only after assessing the migration state.
5. Verify backend health before restoring frontend traffic.
6. Repeat the production acceptance checklist for affected workflows.

Application rollback and database rollback are separate operations. Rolling
back application code does not automatically reverse a database migration.

---

## 10. Common deployment problems

### Frontend returns a backend `502`

- Confirm the backend service is healthy.
- Confirm `BACKEND_URL` uses HTTPS.
- Confirm `BACKEND_URL` does not end with `/api`.
- Redeploy the frontend after changing `BACKEND_URL`.

### Render reports that no port was opened

- Backend start command must run the NestJS `start` script.
- Frontend start command must include `-H 0.0.0.0 -p $PORT`.
- Do not replace Render's `PORT` with a hard-coded port.

### Database connection fails

- Use the Render Postgres internal URL.
- Keep the database and backend in the same region.
- Confirm the URL is stored as `DATABASE_URL`.
- Do not expose or paste the connection string into logs or support messages.

### Payment verification always reports simulation

- Confirm `SHEGERPAY_API_KEY` is a live ShegerPay key.
- Redeploy or restart the backend after changing the key.
- Never make a test response appear as genuine verification.

### Build cannot find workspace dependencies

- Leave Root Directory blank.
- Run installation from the repository root.
- Use pnpm with `pnpm-lock.yaml`.
- Do not use npm or yarn for this workspace.

---

## Official Render references

- Web Services: https://render.com/docs/web-services
- Monorepo Support: https://render.com/docs/monorepo-support
- Multi-Service Architectures: https://render.com/docs/multi-service-architecture
- Create and Connect Render Postgres:
  https://render.com/docs/postgresql-creating-connecting
- Deploys and Rollbacks: https://render.com/docs/deploys
