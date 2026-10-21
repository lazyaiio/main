import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { listProjects } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";
import { excerpt } from "@/lib/format";
import { PROJECT_TYPES, languageLabel } from "@/lib/projects";

export const metadata: Metadata = { title: "Projects" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProjectsPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const params = await searchParams;
  const projects = await listProjects(await getDb(), ctx.workspace.id);
  const writable = canWrite(ctx.role);

  const newButton = writable ? (
    <ButtonLink href="/app/projects/new">
      <Plus className="h-4 w-4" aria-hidden="true" /> New project
    </ButtonLink>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="A project is where your posts start: a topic, an article, or a website."
        action={projects.length > 0 ? newButton : null}
      />

      {params.notice === "deleted" ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Project deleted.
        </p>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Create your first project"
          body="Tell LazyAI what to write about. You will review everything before anything is scheduled."
          action={newButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const type = PROJECT_TYPES.find((t) => t.value === project.input_type)?.label ?? project.input_type;
            return (
              <li key={project.id}>
                <Link
                  href={`/app/projects/${project.id}`}
                  className="block h-full rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-colors hover:border-brand-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate font-display text-lg font-bold">{project.name}</h2>
                    {project.status === "archived" ? <Badge>Archived</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs font-medium text-ink-400">{type}</p>
                  <p className="mt-2 break-words text-sm text-ink-600">{excerpt(project.input_value, 100)}</p>
                  <p className="mt-4 text-xs text-ink-400">
                    {project.languages.map(languageLabel).join(" · ")} · {formatDate(project.created_at, ctx.workspace.timezone)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
