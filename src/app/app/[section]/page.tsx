import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { appSections, type AppSectionKey } from "@/lib/site";

type Props = { params: Promise<{ section: string }> };

function getSection(key: string) {
  return Object.prototype.hasOwnProperty.call(appSections, key)
    ? appSections[key as AppSectionKey]
    : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const data = getSection(section);
  return { title: data?.title ?? "Not found" };
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const data = getSection(section);
  if (!data) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{data.title}</h1>
        <p className="mt-1 text-ink-600">{data.description}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center">
        <Badge>Coming soon</Badge>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-600">
          This area is not available yet. It will appear here as LazyAI is built out.
        </p>
      </div>
    </div>
  );
}
