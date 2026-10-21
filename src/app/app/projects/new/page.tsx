import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectForm, emptyProjectDefaults } from "@/components/projects/project-form";
import { PageHeader } from "@/components/ui/page-header";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { createProjectAction } from "../actions";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const ctx = await requireAppContext();
  if (!canWrite(ctx.role)) redirect("/app/projects");

  return (
    <div className="space-y-6">
      <Link href="/app/projects" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Projects
      </Link>
      <PageHeader title="New project" description="You can change all of this later." />
      <div className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <ProjectForm action={createProjectAction} submitLabel="Create project" defaults={emptyProjectDefaults} />
      </div>
    </div>
  );
}
