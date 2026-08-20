# Test and Release Runbook

Updated: August 20, 2026

## Required validation

Run validations in a clean environment. Do not run a Next.js production build while the development server is using the same `.next` directory.

### Static checks

```bash
pnpm run typecheck
pnpm --filter @workspace/nextjs-app exec tsc --noEmit --incremental false
pnpm --filter @workspace/nestjs-server exec tsc --noEmit
```

Run package-local build, lint, formatting, and test scripts when present. Absence of a script is a documented gap, not a passing result.

### Security checks

- Dependency audit
- Static application security scan
- Sensitive-data/dataflow scan
- Review all critical and high findings

### Backend checks

- Health and database connectivity
- Valid, invalid, inactive, and expired authentication
- Role and branch authorization matrix
- Order creation and every allowed transition
- Kitchen assignment and ready flow
- Payment completion and table release
- Purchase approval, stock receipt, adjustment, and item request
- Daily summary and notifications
- Invalid and unexpected request fields

### Browser checks

- Login, refresh persistence, and logout
- Direct navigation to protected pages
- Role-specific navigation
- Orders/POS and order board
- Kitchen
- Payments
- Inventory and purchase orders
- Staff and branch management
- Reports, filters, pagination, Excel, and PDF exports
- Loading, empty, error, and retry states
- Desktop, tablet, and phone layouts
- Orders/POS at 320 px and 390 px: no overlapping controls; category tabs scroll horizontally by design; menu, cart, payment fields, and the final action remain reachable without app-owned horizontal overflow

## Release gate

A release may proceed only when:

1. Mandatory checks pass.
2. No unresolved critical security finding exists.
3. High findings are fixed or formally accepted by an authorized reviewer.
4. Database backup and rollback are verified.
5. Production environment variables are present without exposing their values.
6. The final smoke test passes against the release candidate.

## Rollback trigger

Rollback when authentication, branch isolation, order/payment integrity, inventory balance, reporting, or database migration checks fail. Do not attempt repeated production hot fixes without a known-good checkpoint.