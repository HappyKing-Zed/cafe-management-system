---
name: PostgreSQL parent-row locks
description: Why order mutations and payment must lock the parent row before loading related items.
---

For concurrent order operations, acquire the pessimistic lock with a join-free query on the order row, then load its items separately through the same transaction manager.

**Why:** PostgreSQL rejects `FOR UPDATE` when TypeORM applies it across the nullable side of an outer join. Using the shared parent row as the lock boundary also makes late-item changes and payment serialize against each other.

**How to apply:** Any transaction that validates or changes an order and its items should lock only the order first. Do not add relation joins to that locking query; fetch child rows only after the lock is held.