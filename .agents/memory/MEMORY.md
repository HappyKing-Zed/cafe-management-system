# Memory Index

- [Browser-to-backend routing](nextjs-artifact-routing.md) — browser API calls must use `/backend/api`; `/api` belongs to a separate workspace artifact.
- [Deployment startup readiness](deployment-startup-readiness.md) — bind the backend health port before nonessential account/data provisioning so Autoscale publish probes cannot time out.
- [Item-assigned kitchen workflow](item-assigned-kitchen-workflow.md) — keep one parent order while kitchen, service, and settlement progress independently per item.
- [Next.js build/dev race](next-build-dev-race.md) — verify production builds away from a running `next dev`; both commands share `.next` and can create false failures.
- [PostgreSQL parent-row locks](postgres-parent-row-locks.md) — lock orders without outer joins, then load children in the same transaction to serialize item changes and payment.
- [Synchronize-to-migration compatibility](synchronize-migration-compatibility.md) — migrations must tolerate schema objects already created by TypeORM synchronize, including constraint backing indexes.
- [Electronic payment verification](electronic-payment-verification.md) — verify externally on the server and reject reused transaction IDs before confirming electronic payments.
