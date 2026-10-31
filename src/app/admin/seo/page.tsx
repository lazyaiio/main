import type { Metadata } from "next";
import Link from "next/link";
import { savePageSeoAction, saveSiteSeoAction, saveTrackingAction, saveVerificationAction } from "@/app/admin/seo/actions";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { getPublicEnv } from "@/lib/env";
import { readPageOverrides, readSeoSettings } from "@/lib/data/seo";
import { EMPTY_OVERRIDE, SEO_PAGES, auditSeo, effectiveSeo, type AuditItem } from "@/lib/seo";

export const metadata: Metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";
const MARK: Record<AuditItem["level"], { symbol: string; cls: string; word: string }> = {
  ok: { symbol: "✓", cls: "bg-emerald-50 text-emerald-700", word: "Good" },
  warn: { symbol: "!", cls: "bg-amber-50 text-amber-800", word: "Check" },
  bad: { symbol: "✕", cls: "bg-red-50 text-red-700", word: "Problem" },
};

export default async function SeoAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [s, overrides] = await Promise.all([readSeoSettings(), readPageOverrides()]);
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const audit = auditSeo({ settings: s, overrides, appUrl });
  const notice = typeof sp.notice === "string" ? sp.notice.slice(0, 200) : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 250) : undefined;
  const groups = ["Site", "Pages", "Search consoles", "Tracking"] as const;
  const problems = audit.filter((a) => a.level !== "ok").length;

  const text = (name: string, title: string, value: string, opts: { max?: number; hint?: string; placeholder?: string } = {}) => (
    <label className={label}>
      {title}
      <input name={name} defaultValue={value} maxLength={opts.max ?? 300} placeholder={opts.placeholder} className={input} />
      {opts.hint ? <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-ink-500">{opts.hint}</span> : null}
    </label>
  );
  const card = "space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card";

  return (
    <div className="space-y-6">
      <PageHeader title="SEO" description="How search engines see the public website. All text must be in English." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className={card} aria-label="Health check">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Health check</h2>
          <p className="text-sm text-ink-600">{problems === 0 ? "Everything looks good." : `${problems} thing${problems === 1 ? "" : "s"} to look at.`}</p>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{g}</h3>
            <ul className="mt-2 divide-y divide-ink-100">
              {audit.filter((a) => a.group === g).map((a) => (
                <li key={`${g}-${a.label}`} className="flex items-start gap-3 py-2 text-sm">
                  <span className={`mt-0.5 inline-flex h-5 min-w-[3.25rem] shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold ${MARK[a.level].cls}`}>
                    {MARK[a.level].symbol} {MARK[a.level].word}
                  </span>
                  <span>
                    <span className="font-medium text-ink">{a.label}</span>
                    <span className="block text-ink-600">{a.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-sm text-ink-600">
          Open{" "}
          <Link href="/sitemap.xml" target="_blank" className="font-semibold text-brand hover:underline">sitemap.xml</Link> and{" "}
          <Link href="/robots.txt" target="_blank" className="font-semibold text-brand hover:underline">robots.txt</Link> to see what search engines get. Submit <code>{appUrl}/sitemap.xml</code> in Google Search Console and Bing Webmaster Tools after verifying the site.
        </p>
      </section>

      <form action={saveSiteSeoAction} className={card}>
        <h2 className="font-display text-lg font-bold">Site settings</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="allowIndexing" defaultChecked={s.allowIndexing} className="mt-0.5 h-4 w-4 accent-brand" />
          <span>
            <span className="font-medium">Let search engines index the public site</span>
            <span className="block text-xs text-ink-500">Turn off only for a test site. When off, every page says &ldquo;noindex&rdquo; and robots.txt blocks all crawlers.</span>
          </span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {text("defaultTitle", "Home page title", s.defaultTitle, { max: 70, hint: "About 50 to 60 characters." })}
          {text("titleTemplate", "Title pattern for other pages", s.titleTemplate, { max: 60, hint: "%s is replaced by the page title, for example: %s · LazyAI" })}
        </div>
        <label className={label}>
          Site description
          <textarea name="defaultDescription" rows={3} maxLength={200} defaultValue={s.defaultDescription} className={input} />
          <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-ink-500">Shown under the title in search results. About 70 to 160 characters.</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {text("ogImageUrl", "Share image address", s.ogImageUrl, { placeholder: "https://…", hint: "Shown when the site is shared on Facebook, X, LinkedIn. 1200 by 630 pixels. Empty = the built-in image." })}
          {text("twitterHandle", "X (Twitter) name", s.twitterHandle, { max: 16, placeholder: "yourname" })}
          {text("orgName", "Organization name", s.orgName, { max: 80 })}
          {text("orgLogoUrl", "Organization logo address", s.orgLogoUrl, { placeholder: "https://…", hint: "A square logo, at least 112 by 112 pixels." })}
        </div>
        <label className={label}>
          Social profile links (one per line)
          <textarea name="sameAs" rows={3} defaultValue={s.sameAs.join("\n")} className={input} placeholder="https://www.facebook.com/yourpage" />
        </label>
        <label className={label}>
          Extra pages to hide from crawlers (one path per line)
          <textarea name="robotsExtra" rows={2} defaultValue={s.robotsExtra.join("\n")} className={input} placeholder="/private-page" />
          <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-ink-500">The app, admin, sign-in and checkout areas are always hidden.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="blockAiCrawlers" defaultChecked={s.blockAiCrawlers} className="mt-0.5 h-4 w-4 accent-brand" />
          <span>
            <span className="font-medium">Ask AI training crawlers to stay away</span>
            <span className="block text-xs text-ink-500">Asks bots that collect text to train AI models (GPTBot, ClaudeBot, Google-Extended and similar) not to read the site. Normal search engines are not affected. It can lower how often AI assistants mention the site.</span>
          </span>
        </label>
        <PendingButton pendingLabel="Saving…" variant="primary">Save site settings</PendingButton>
      </form>

      <section className={card}>
        <h2 className="font-display text-lg font-bold">Pages</h2>
        <p className="text-sm text-ink-600">Leave a box empty to use the built-in text. &ldquo;Hide from search&rdquo; adds noindex and removes the page from the sitemap.</p>
        <div className="divide-y divide-ink-100">
          {SEO_PAGES.map((page) => {
            const o = overrides[page.path] ?? EMPTY_OVERRIDE;
            const eff = effectiveSeo(page.path, s, overrides[page.path] ?? null);
            return (
              <details key={page.path} className="py-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {page.label} <span className="text-xs font-normal text-ink-500">{page.path}</span>
                  </span>
                  <span className="text-xs text-ink-500">{eff.noindex ? "Hidden from search" : `${eff.shownTitle.length} / ${eff.description.length} characters`}</span>
                </summary>
                <form action={savePageSeoAction} className="mt-3 space-y-3">
                  <input type="hidden" name="path" value={page.path} />
                  <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <span className="block font-medium text-brand-700">{eff.shownTitle}</span>
                    <span className="block text-xs text-emerald-700">{appUrl.replace(/^https?:\/\//, "")}{page.path === "/" ? "" : page.path}</span>
                    <span className="block text-ink-600">{eff.description}</span>
                  </p>
                  {text("title", "Title", o.title, { max: 90, placeholder: page.path === "/" ? s.defaultTitle : page.title })}
                  <label className={label}>
                    Description
                    <textarea name="description" rows={2} maxLength={220} defaultValue={o.description} placeholder={page.path === "/" ? s.defaultDescription : page.description} className={input} />
                  </label>
                  {text("ogImage", "Share image address (optional)", o.ogImage, { placeholder: "https://…" })}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="noindex" defaultChecked={o.noindex} className="h-4 w-4 accent-brand" /> Hide from search engines
                  </label>
                  <PendingButton pendingLabel="Saving…">Save {page.label}</PendingButton>
                </form>
              </details>
            );
          })}
        </div>
      </section>

      <form action={saveVerificationAction} className={card}>
        <h2 className="font-display text-lg font-bold">Search engine verification</h2>
        <p className="text-sm text-ink-600">Paste the code, or the whole <code>&lt;meta …&gt;</code> tag, that each service gives you. The tag is added to the head of every page.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {text("google", "Google Search Console", s.verification.google)}
          {text("bing", "Bing Webmaster Tools", s.verification.bing)}
          {text("yandex", "Yandex Webmaster", s.verification.yandex)}
          {text("baidu", "Baidu Webmaster", s.verification.baidu)}
          {text("pinterest", "Pinterest", s.verification.pinterest)}
          {text("facebook", "Facebook domain verification", s.verification.facebook)}
        </div>
        <label className={label}>
          Other tags (name | value, one per line)
          <textarea name="customMeta" rows={2} defaultValue={s.customMeta.map((m) => `${m.name} | ${m.content}`).join("\n")} className={input} placeholder="naver-site-verification | abc123" />
        </label>
        <PendingButton pendingLabel="Saving…" variant="primary">Save verification</PendingButton>
      </form>

      <form action={saveTrackingAction} className={card}>
        <h2 className="font-display text-lg font-bold">Analytics and ad tags (optional)</h2>
        <p className="text-sm text-ink-600">
          These load only on the public pages, and only after a visitor presses Accept in the cookie banner. Our own statistics (Admin, Analytics) need none of them. If you add the Meta Pixel (an advertising tool), the Privacy Policy sentence &ldquo;we do not use your information for advertising&rdquo; must be changed first.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {text("ga4", "Google Analytics 4 ID", s.tracking.ga4, { placeholder: "G-XXXXXXXXXX", max: 20 })}
          {text("gtm", "Google Tag Manager ID", s.tracking.gtm, { placeholder: "GTM-XXXXXXX", max: 20, hint: "If you use Tag Manager, put Google Analytics inside it and leave the GA4 box empty, so visits are not counted twice." })}
          {text("metaPixel", "Meta Pixel ID", s.tracking.metaPixel, { placeholder: "1234567890", max: 20 })}
          {text("clarity", "Microsoft Clarity project ID", s.tracking.clarity, { placeholder: "abcdefghij", max: 12 })}
        </div>
        <PendingButton pendingLabel="Saving…" variant="primary">Save tags</PendingButton>
      </form>
    </div>
  );
}
