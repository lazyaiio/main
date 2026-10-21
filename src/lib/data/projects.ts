import "server-only";
import type { Db } from "./db";
import { unwrap } from "./db";
import type { Language, ProjectInputType, ProjectRow, ProjectSettings, ProjectStatus } from "./types";

export type ProjectInput = {
  name: string;
  inputType: ProjectInputType;
  inputValue: string;
  languages: Language[];
  settings: ProjectSettings;
};

export async function listProjects(db: Db, workspaceId: string): Promise<ProjectRow[]> {
  const res = await db
    .from("content_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (unwrap(res, "load projects") ?? []) as ProjectRow[];
}

export async function getProject(db: Db, workspaceId: string, id: string): Promise<ProjectRow | null> {
  const res = await db
    .from("content_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return unwrap(res, "load the project") as ProjectRow | null;
}

export async function insertProject(db: Db, workspaceId: string, input: ProjectInput): Promise<string | null> {
  const res = await db
    .from("content_projects")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      input_type: input.inputType,
      input_value: input.inputValue,
      languages: input.languages,
      settings: input.settings,
    })
    .select("id")
    .single();
  const row = unwrap(res, "create the project") as { id: string } | null;
  return row?.id ?? null;
}

/** Returns true when exactly one row was changed (RLS hides rows the user may not touch). */
export async function updateProject(db: Db, workspaceId: string, id: string, input: ProjectInput): Promise<boolean> {
  const res = await db
    .from("content_projects")
    .update({
      name: input.name,
      input_type: input.inputType,
      input_value: input.inputValue,
      languages: input.languages,
      settings: input.settings,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("id");
  return ((unwrap(res, "update the project") as unknown[] | null) ?? []).length === 1;
}

export async function setProjectStatus(db: Db, workspaceId: string, id: string, status: ProjectStatus): Promise<boolean> {
  const res = await db
    .from("content_projects")
    .update({ status })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("id");
  return ((unwrap(res, "update the project") as unknown[] | null) ?? []).length === 1;
}

export async function deleteProject(db: Db, workspaceId: string, id: string): Promise<boolean> {
  const res = await db
    .from("content_projects")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("id");
  return ((unwrap(res, "delete the project") as unknown[] | null) ?? []).length === 1;
}

export async function countProjectChildren(
  db: Db,
  workspaceId: string,
  projectId: string,
): Promise<{ campaigns: number; content: number }> {
  const [campaigns, content] = await Promise.all([
    db.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("project_id", projectId),
    db.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("project_id", projectId),
  ]);
  if (campaigns.error || content.error) throw new Error("Could not load project details.");
  return { campaigns: campaigns.count ?? 0, content: content.count ?? 0 };
}
