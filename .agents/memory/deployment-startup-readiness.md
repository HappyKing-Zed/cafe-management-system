---
name: Deployment startup readiness
description: Why the backend must listen before optional database provisioning during Autoscale startup.
---

The restaurant backend must open its configured port and health endpoint before running nonessential account or sample-data provisioning. Provisioning should run afterward with explicit error logging and must not be able to stop the server from becoming ready.

**Why:** Replit Autoscale waits for every artifact service port during publish. A production database update blocked startup long enough for the backend port check to time out, even though all builds completed successfully.

**How to apply:** Keep database connection initialization on the critical path, but move optional account reconciliation, seed maintenance, and legacy-data cleanup after the server is listening. Health routes must remain fast and independent of those background updates.