# LazyAI

**Work less. Publish more.** — AI-assisted content planning and scheduling for Facebook Pages (English & Bengali).

Full plan: [`docs/LAZYAI_MASTER_PLAN.md`](docs/LAZYAI_MASTER_PLAN.md) · Build status: [`docs/BUILD_PROGRESS.md`](docs/BUILD_PROGRESS.md)

## Stack
Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Zod · Supabase · Vercel · Resend

## Uploading to GitHub with drag and drop

GitHub's browser uploader accepts **at most 100 files per upload** (and 25 MB per file). Every batch zip is built to respect this.

1. Unzip the batch on your computer. Do **not** drag the `.zip` itself — GitHub will not extract it.
2. Open your repository on GitHub → **Add file → Upload files**.
3. Open the unzipped folder, select **everything inside it** (not the folder itself) and drag it into the page.
4. Hidden items must be included: `.github/` (CI), `.gitignore`, `.env.example`. On Mac press `Cmd + Shift + .` to show them; on Windows enable "Hidden items".
5. Wait until GitHub finishes listing all files, then **Commit changes** to `main`.
6. If a batch has more than 100 files it ships as `part1`, `part2`, … — upload them one after another, each as its own commit.
7. Files **deleted or renamed** in a batch are listed in that batch's notes; remove them on GitHub by opening the file → `⋯` → Delete.

## Deploying (free tiers while in development)
1. Vercel → **Add New → Project** → import this GitHub repo (framework: Next.js is auto-detected).
2. Add environment variables from `.env.example` as each batch needs them: `NEXT_PUBLIC_APP_URL`, and for sign-in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `docs/SUPABASE_SETUP.md`).
3. Every commit to `main` deploys to production; other branches get preview URLs.

## Local commands (optional — only if you run it on your own machine)
```bash
npm install
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
```

## Safety rules
No secrets in the repo. Real credentials live only in Vercel/Supabase dashboards. Live publishing, real customer emails, DNS changes, and paid operations always need explicit approval.
