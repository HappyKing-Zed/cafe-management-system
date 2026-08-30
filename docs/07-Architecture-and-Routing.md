# Architecture and Routing

Updated: August 20, 2026

## Canonical architecture

Jima is a modular monolith with three logical tiers:

```text
Browser
  ↓ HTTPS
Next.js frontend
  ↓ REST/JSON
NestJS backend
  ↓ TypeORM
PostgreSQL
```

The frontend never connects to PostgreSQL. NestJS owns business rules, authentication, authorization, validation, transactions, and persistence.

## Artifact ownership

| Area | Canonical location | Notes |
|---|---|---|
| Registered web artifact | Jima web artifact | Routing/registration shim |
| Frontend source | `artifacts/nextjs-app` | Next.js 15, React 19 |
| Restaurant API | `artifacts/nestjs-server` | NestJS 10 modular monolith |
| Database entities | `artifacts/nestjs-server/src/entities` | TypeORM entities |
| Business modules | `artifacts/nestjs-server/src/modules` | Controllers and services |
| Separate API artifact | `artifacts/api-server` | Not the restaurant API |
| Component preview | `artifacts/mockup-sandbox` | Design-only preview |

## Request path

1. Browser code calls `/backend/api/<resource>`.
2. Next.js rewrites that path to `${BACKEND_URL}/api/<resource>`.
3. NestJS handles the request under its `/api` global prefix.
4. Services use TypeORM repositories to access PostgreSQL.

Do not change the browser base to `/api`. That path belongs to a separate registered artifact in this workspace. Any future path change must update the frontend API client, Next.js rewrite, backend prefix, deployment routing, tests, and all documentation together.

## Responsibility boundaries

### Frontend

- Presentation, navigation, forms, loading/error states
- Appropriate client state
- Non-authoritative client validation
- API communication

### Backend

- Authentication and authoritative authorization
- Role, restaurant, and branch scope
- Input validation and error mapping
- Business workflows and calculations
- Transactions and database operations

### Database

- Persistence and relations
- Constraints and indexes
- Transactional integrity
- Migration history

## Branch Stock Request / Main Store workflow

The workflow separates requesting, deciding, and physically moving stock:

| Actor | Scope | Allowed workflow actions |
|---|---|---|
| Branch storekeeper (branch assigned) | Own restaurant and assigned destination branch | Browse requestable Main Store items, create a request, view branch requests |
| Manager | Own restaurant and assigned branch | View and approve or reject pending requests for that destination branch |
| Owner | Own restaurant | View and approve or reject requests across restaurant branches |
| Main Store storekeeper (no branch assigned) | Own restaurant Main Store | View Main Store data and fulfill approved requests |

The status paths are `pending` → `approved` → `transferred` and `pending` → `rejected`. A request captures its destination, requester, requested lines, and item metadata. Creating, approving, or rejecting it does **not** reserve, debit, or credit stock.

Fulfillment is the stock boundary. NestJS locks and validates the approved transfer, destination branch, Main Store items, and available quantities inside one database transaction. It then:

1. decreases each Main Store item balance;
2. increases the matching destination-branch inventory item balance, creating that branch item when needed;
3. stores Main Store and branch balances after each transfer line;
4. writes a linked Main Store `STOCK_OUT` movement and branch stock-addition adjustment for each line; and
5. records the fulfilling actor/time and changes the status to `transferred`.

Every lookup and mutation is restaurant-scoped. Managers and branch storekeepers are additionally constrained to their assigned branch. If any line, balance check, destination, or write fails, the entire fulfillment rolls back; partial stock movement or partial audit history must not persist.

## Architectural risks

- The frontend API facade is centralized but broad.
- Several UI pages combine presentation, polling, forms, and transformation logic.
- DTO validation is incomplete.
- Database configuration and entity registration are concentrated in the root application module.
- `artifacts/api-server` and unused generated libraries can confuse ownership.

Do not address these risks with microservices or an ORM replacement. Refactor one business area at a time behind stable API contracts.