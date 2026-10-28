# ADR 0008: Deployment checks and dependency policy

Status: accepted (Batch 12)

## Context
Batch 11 added Dependabot. It proposed major upgrades (Tailwind 4, TypeScript 7, Zod 4, tailwind-merge 3) whose Preview builds failed or could not be trusted: Tailwind 4 and TypeScript 7 changed their configuration and compiler, and tailwind-merge 3 only works with Tailwind 4. The live site was never affected, because Dependabot only creates pull requests.

## Decision
1. Dependabot no longer proposes **major** npm upgrades. Minor and patch updates stay grouped in one weekly pull request. GitHub Actions updates stay on.
2. Major upgrades are planned by hand, one at a time, as their own batch with tests.
3. A pull request is merged only when the Vercel Preview **and** the GitHub Actions checks are green.
4. The owner gets **Admin -> Deployment**: a read-only page that reports whether settings exist (never their values), checks the app address, probes one table per migration, and lists the addresses to register in other services. It makes no changes.
5. Production rollbacks use Vercel's "Promote to Production" first, a GitHub revert second. Database migrations are additive and are never rolled back by hand.

## Consequences
Fewer red previews and less noise. Staying on current majors means security fixes for those majors continue, but a future major upgrade is real work to schedule (suggested after launch).
