# Memory Index

- [Next.js/NestJS routing](nextjs-artifact-routing.md) — preview needs the registered Abajiraf shim; frontend calls backend via `/backend/api`, not `/api`; `.replit` port entries do not route preview.
- [Deployment startup readiness](deployment-startup-readiness.md) — bind the backend health port before nonessential account/data provisioning so Autoscale publish probes cannot time out.
- [Next.js build/dev race](next-build-dev-race.md) — verify production builds away from a running `next dev`; both commands share `.next` and can create false failures.
