# ADR 0009: Release readiness

Status: accepted (Batch 13)

## Decisions
1. **Accessibility is guarded by tests, not only by review.** `src/lib/release-readiness.test.ts` fails the build if an image lacks alt text, a page lacks the skip-link target, zoom is blocked, gray text with too little contrast is added, or a new-tab link lacks `rel`.
2. **Gray text uses `text-ink-500` or darker** (contrast about 5.5 to 1 on white). The lighter grays are for icons and the dark section only.
3. **Every status and failure code must have plain words.** Tests compare the status values allowed by the database with the label maps, and check that every publishing failure code has its own explanation.
4. **Customers never see operator instructions.** Setup hints that mention Vercel, Meta app setup, or repository files appear only for platform admins.
5. **Launch needs the owner's written approval** (`docs/RELEASE_CHECKLIST.md`, section 6). Real posting, DNS changes, and paid upgrades stay manual decisions.
6. **Not automated yet:** browser end-to-end tests. The walk-through is a manual checklist because the project has no browser test runner or CI secrets for a live Supabase project. Adding one is a candidate for after launch.
