---
name: Synchronize-to-migration compatibility
description: How production migrations must handle databases whose schema was previously created by TypeORM synchronize.
---

Production migrations must be idempotent when tables, columns, constraints, or
constraint backing indexes may already exist from an earlier
`synchronize=true` environment. Prefer catalog-aware existence checks or
PostgreSQL `IF NOT EXISTS` DDL over broad exception handlers.

**Why:** PostgreSQL can report an existing constraint backing index as a
duplicate relation rather than `duplicate_object`. A migration that catches
only one exception class can repeatedly crash application startup even though
the required uniqueness rule already exists.

**How to apply:** When adding uniqueness or indexes to legacy Jima tables,
account for both explicit constraints and standalone indexes with the intended
name. Validate migrations against both a fresh database and a synchronized
legacy schema before production publishing.