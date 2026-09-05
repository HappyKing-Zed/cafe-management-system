---
name: Item-assigned kitchen workflow
description: Durable boundary between specialist kitchen execution and order-level financial aggregation.
---

Assign and advance kitchen work at the order-item level, with each item owned by one branch-scoped kitchen worker. Keep the service code, total, served completion, and payment at the parent-order level.

**Why:** One guest order may contain food, bar, juice, and coffee items that must progress independently, while the customer and cashier still require one bill and exactly one payment.

**How to apply:** New kitchen roles or stations may change item assignment and visibility, but must not create child orders or split payments. Parent payment is allowed only after every item has been served.