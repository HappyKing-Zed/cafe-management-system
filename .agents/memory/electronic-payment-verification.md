---
name: Electronic payment verification
description: Integrity rules for externally verified cashier payments.
---

Externally verified electronic payments must be checked server-side against the server-calculated payable amount, and a verified transaction ID must not be accepted more than once.

**Why:** Browser-side verification can be bypassed, client-supplied amounts can be altered, and a genuine payment reference can otherwise be reused to settle multiple orders.

**How to apply:** Keep provider credentials on the backend, fail without recording payment when verification is unsuccessful or unavailable, and preserve the provider's verification metadata for audit and reporting.