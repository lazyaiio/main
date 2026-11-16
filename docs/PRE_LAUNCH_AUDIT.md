# Pre-launch audit (Batch 25)

What was checked by running things on the build machine, what was fixed, and what only a person can check.

## Checks that were run (real runs)
| Check | Result |
|---|---|
| `npm install` | OK (415 packages) |
| `tsc --noEmit` | PASS |
| `next lint` | PASS (no warnings or errors) |
| `vitest run` | PASS: 76 files, 707 tests (4 new guard tests) |
| `next build` (scratch copy, Google fonts stubbed because the build machine has no network) | PASS |
| `npm audit --omit=dev` | before: 4 findings (3 high, 1 moderate); after: 3 (see below) |
| Page looked at in a real browser, real devices, screen readers | **NOT DONE** |

## Found and fixed
1. **sharp (image thumbnails) had known vulnerabilities** in its image libraries. Raised to `^0.35.5` (needs Node 20.9 or newer; `engines` updated; Vercel and CI use Node 22). The thumbnail and media tests pass on the new version.
2. **Bengali characters in a test file** (`lifetime-deal.test.ts`) broke the project rule "no Bengali in source files". Replaced with `\u` escapes. A new guard test now scans all of `src` and `docs`.
3. **Campaign form lists had no upper limit** for post formats and posting days. Limits added (formats: at most twice the number of formats; posting days: at most 14). Normal use is not affected.

## Checked and fine (no change needed)
- Every one of the 38 database tables created by the migrations has row level security turned on (now enforced by a test).
- Every API route is accounted for and has a way of proving who is calling: sign-in session, platform admin check, scheduler secret, email signature, Meta signed request, or (bKash callback) confirmation with bKash itself. Two routes are public on purpose: the health check and the cookie-free page view beacon. A new route now fails a test until it is added to the list on purpose.
- The only use of raw HTML is the structured-data script, which escapes `<` and line separators.
- No environment variable is used without being listed in `.env.example`, except the three that Vercel sets itself.
- Security headers are in place (no framing, no sniffing, HSTS, referrer and permissions policies).

## Still open (known, not fixed here)
| Item | Why it is open | What to do |
|---|---|---|
| `postcss` inside Next.js (advisory about CSS output and source maps) | The fix needs Next.js 16, a major upgrade. LazyAI only runs PostCSS at build time on its own CSS, never on visitor input. | Plan "Next 16" as its own batch after launch. |
| `zod` 3 (advisory about very large constrained lists) | The fix needs Zod 4, a major upgrade. I have not confirmed that version 3 is affected; the audit tool flags it by version range. Lists from visitors now have limits; lists in answers from Facebook, Pexels, Pixabay and Unsplash are trusted providers. | Plan "Zod 4" as its own batch after launch. |
| Content-Security-Policy is minimal (`frame-ancestors`, `base-uri`, `object-src`) | A full script policy can break the app, the analytics tags, and the cookie banner. | Try a report-only policy first, after launch. |
| Pages never looked at in a browser by the build machine | No browser here. | Owner checklist below. |

## Owner checklist (needs a person)
1. Upload the files (see `UPLOAD_ORDER.txt`), wait for GitHub Actions and Vercel to go green.
2. Open Admin -> Launch checklist and fix every red item.
3. On a phone and on a laptop, walk through: sign up, pay (sandbox), create a post, schedule, connect a Page, open every public page and the docs.
4. Re-run the SQL tests in `supabase/tests/` that you have not run since their batch.
5. Have a lawyer read the legal pages. Submit Meta App Review.
6. Before real customers: `docs/GO_LIVE_UPGRADE_CHECKLIST.md` (paid Vercel and Supabase plans, backups).
