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

### Branch Stock Request / Main Store release cases

Use at least two restaurants, two branches in one restaurant, branch-assigned storekeepers/managers, an owner, and a Main Store storekeeper without a branch assignment. Record starting Main Store and branch balances before each case.

1. **Request and visibility:** As a branch storekeeper, request multiple valid Main Store items. Verify the request is `pending`, targets only that user's branch, is visible to that branch's manager and the restaurant owner, and is not visible to another branch or restaurant.
2. **No early stock mutation:** Compare balances and movement/adjustment counts before and after request creation, approval, and rejection. Request/decision steps must not change Main Store or branch stock and must not create stock movement records.
3. **Decision authorization:** Verify the destination-branch manager and restaurant owner can approve or reject a pending request. Verify another branch's manager, a branch storekeeper, and a Main Store storekeeper cannot decide it. A second decision on a non-pending request must fail.
4. **Fulfillment authorization and lifecycle:** Verify only the same-restaurant Main Store storekeeper (no branch assignment) can fulfill an `approved` request. Pending, rejected, already transferred, and cross-restaurant transfers must fail.
5. **Atomic successful movement:** Fulfill an approved multi-line request. Verify status `transferred`; each Main Store balance decreases by the requested quantity; each destination-branch balance increases by the same quantity; no other branch changes; and the fulfilling actor/time are recorded.
6. **Audit and balances:** For every fulfilled line, verify the stored Main Store and branch post-transfer balances, one linked Main Store `STOCK_OUT` movement, and one linked branch addition adjustment. Confirm quantities, actor, transfer ID, and resulting balances agree with inventory.
7. **Atomic failure:** Approve a multi-line request for which at least one line has insufficient Main Store stock at fulfillment time. Verify the request remains `approved` and that no line changes stock, creates a destination item, writes an audit record, or stores a post-transfer balance.

### Browser checks

- Login, refresh persistence, and logout
- Direct navigation to protected pages
- Role-specific navigation
- Orders/POS and order board
- Kitchen
- Payments
- Inventory and purchase orders
- Main Store Requests: branch submission, manager/owner decision, Main Store fulfillment, status/history, and role-appropriate controls
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