import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { GenerateForm } from "@/components/content/generate-form";
import { ManualForm } from "@/components/content/manual-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isCurrentUserPlatformAdmin } from "@/lib/auth/admin";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { listProjects } from "@/lib/data/projects";
import { getAiAvailability } from "@/lib/services/generation";

export const metadata: Metadata = { title: "New post" };

// Generating a post can take a while; ask the host for the longest allowed run time.
export const maxDuration = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewPostPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  if (!canWrite(ctx.role)) redirect("/app/content");

  const params = await searchParams;
  const projects = (await listProjects(await getDb(), ctx.workspace.id)).filter((p) => p.status === "active");
  const [availability, isAdmin] = await Promise.all([getAiAvailability(), isCurrentUserPlatformAdmin()]);

  const requested = typeof params.project === "string" ? params.project : "";
  const defaultProjectId = projects.find((p) => p.id === requested)?.id ?? projects[0]?.id ?? "";

  return (
    <div className="space-y-8">
      <Link href="/app/content" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Content
      </Link>
      <PageHeader title="New post" description="Let AI write a first draft, or write it yourself. You review everything before it is scheduled." />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Create a project first"
          body="Posts belong to a project, which holds your topic, languages, and tone."
          action={<ButtonLink href="/app/projects/new">Create a project</ButtonLink>}
        />
      ) : (
        <>
          <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-lg font-bold">Generate with AI</h2>
            {!availability.available ? (
              <p role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                AI generation is not set up yet.{" "}
                {isAdmin ? (
                  <Link href="/admin/ai-providers" className="font-semibold underline">
                    Add a key and turn on a provider.
                  </Link>
                ) : (
                  "Ask an admin to add an API key and turn on a provider."
                )}{" "}
                You can still write a post by hand below.
              </p>
            ) : availability.usingMock ? (
              <p role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Test mode: sample text is used instead of a real AI provider.
              </p>
            ) : null}
            <div className="mt-4">
              <GenerateForm
                available={availability.available}
                defaultProjectId={defaultProjectId}
                projects={projects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  languages: p.languages,
                  inputType: p.input_type,
                  inputValue: p.input_value,
                }))}
              />
            </div>
          </section>

          <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-lg font-bold">Write it yourself</h2>
            <div className="mt-4">
              <ManualForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProjectId={defaultProjectId} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
