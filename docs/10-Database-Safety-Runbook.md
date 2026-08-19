# Database Safety Runbook

Updated: August 19, 2026

## Current state

PostgreSQL is accessed by the NestJS backend through TypeORM. The frontend has no database connection. TypeORM schema synchronization is currently enabled and no verified production migration history is recorded.

Production database changes are **BLOCKED** until the safeguards below are complete.

## Mandatory safeguards

1. Take a restorable database backup.
2. Verify restore into an isolated database.
3. Capture the current schema as a reviewed migration baseline.
4. Run migration status and dry-run checks against an isolated database.
5. Disable `synchronize` in production.
6. Apply migrations through one controlled release process.
7. Record rollback instructions for every migration.

## Forbidden operations

- Pointing a synchronized development backend at production
- Running seed operations against production
- Deleting tables, columns, or production data without explicit approval
- Introducing a second ORM as a parallel schema owner
- Applying unreviewed generated migrations

## Transactions

Inventory purchase approval, stock receipt, stock adjustment, and daily summary locking already demonstrate transaction patterns. Order creation, item changes, status transitions, table occupancy, payments, and shifts require equivalent atomicity review.

## Integrity review

Verify:

- Foreign keys and delete behavior
- Unique email and business identifiers
- Restaurant/branch consistency
- Decimal precision for money
- Status transition validity
- Duplicate payment and receipt prevention
- Indexes for branch, date, status, user, table, and common report filters

## Backup and rollback evidence

For every release that changes persistence, record:

- Backup timestamp and retention
- Restore-test result
- Migration identifier and checksum
- Forward command
- Rollback command
- Expected data transformation
- Responsible reviewer
- Post-migration smoke-test result

Never include credentials or signed backup URLs in the record.