import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProjectDangerZone } from "@/components/projects/project-danger-zone";
import { ProjectForm } from "@/components/projects/project-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { canAdmin, canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { countProjectChildren, getProject } from "@/lib/data/projects";
import { PROJECT_TYPES, languageLabel } from "@/lib/projects";
import { updateProjectAction } from "../actions";

export const metadata: Metadata = { title: "Project" };

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, string> = {
  created: "Project created.",
  archived: "Project archived.",
  restored: "Project restored.",
};

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to do that.",
  not_found: "That project could not be found.",
  in_use: "This project has campaigns or posts. Archive it instead.",
  failed: "Something went wrong. Please try again.",
};

export default async function ProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  if (!z.string().uuid().safeParse(projectId).success) notFound();

  const ctx = await requireAppContext();
  const db = await getDb();
  const project = await getProject(db, ctx.workspace.id, projectId);
  if (!project) return notFound();

  const counts = await countProjectChildren(db, ctx.workspace.id, project.id);
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const type = PROJECT_TYPES.find((t) => t.value === project.input_type)?.label ?? project.input_type;
  const writable = canWrite(ctx.role);

  return (
    <div className="space-y-6">
      <Link href="/app/projects" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Projects
      </Link>
      <PageHeader
        title={project.name}
        description={`${type} · ${project.languages.map(languageLabel).join(", ")}`}
        action={
          <div className="flex items-center gap-2">
            {project.status === "archived" ? <Badge>Archived</Badge> : null}
            {writable && project.status === "active" ? (
              <ButtonLink href={`/app/content/new?project=${project.id}`}>New post</ButtonLink>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-sm text-ink-500">Campaigns</p>
          <p className="mt-2 font-display text-3xl font-extrabold">{counts.campaigns}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-sm text-ink-500">Posts</p>
          <p className="mt-2 font-display text-3xl font-extrabold">{counts.content}</p>
        </div>
      </div>

      {writable ? (
        <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Project details</h2>
          <div className="mt-4">
            <ProjectForm
              action={updateProjectAction}
              submitLabel="Save changes"
              projectId={project.id}
              defaults={{
                name: project.name,
                inputType: project.input_type,
                inputValue: project.input_value,
                languages: project.languages,
                audience: project.settings.audience ?? "",
                tone: project.settings.tone ?? "",
                notes: project.settings.notes ?? "",
              }}
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-700 shadow-card">
          <p className="break-words">{project.input_value}</p>
          <p className="mt-3 text-ink-500">You have read-only access to this workspace.</p>
        </section>
      )}

      {writable ? (
        <ProjectDangerZone projectId={project.id} archived={project.status === "archived"} canDelete={canAdmin(ctx.role)} />
      ) : null}
    </div>
  );
}
