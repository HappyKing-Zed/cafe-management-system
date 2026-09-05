---
name: Item-assigned kitchen workflow
description: Durable boundary between specialist kitchen execution, item settlement, and parent-order aggregation.
---

Assign and advance kitchen work at the order-item level, with each item owned by one branch-scoped kitchen worker. Keep one human-facing order number and parent total, but allow served items to be settled independently through parent payment records with item coverage.

**Why:** One guest order may contain food, bar, juice, and coffee items that finish at different times. Guests may pay items already served without closing the shared order or waiting for every kitchen station.

**How to apply:** Never create child orders. Only served, unpaid items are eligible; each item settles once. Allocate the parent total deterministically, stop item mutation after settlement starts, and mark the parent paid only when every item is served and settled.