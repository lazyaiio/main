import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSitePage } from "@/lib/data/site-pages";
import { EDITABLE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PagesAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rows = await Promise.all([{ slug: "home", label: "Home page", path: "/" }, ...EDITABLE_PAGES].map(async (p) => ({ ...p, saved: await getSitePage(p.slug) })));
  return (
    <div className="space-y-6">
      <PageHeader title="Pages" description="Edit the words on the home page and on the policy, help, contact, and about pages. All text must be in English." />
      {sp.error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">That request was not valid.</p> : null}
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        {rows.map((row) => (
          <li key={row.slug} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-semibold text-ink">{row.label}</p>
              <p className="text-xs text-ink-500">
                {row.path} · {row.saved ? `edited ${new Date(row.saved.updated_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}` : "built-in text"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={row.saved ? "brand" : "neutral"}>{row.saved ? "Edited" : "Built-in"}</Badge>
              <Link href={row.path} target="_blank" className="text-sm font-semibold text-ink-600 hover:underline">
                View
              </Link>
              <Link href={`/admin/pages/${row.slug}`} className="text-sm font-semibold text-brand hover:underline">
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
