import "server-only";
import { canAdmin, canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { DataError, getDb } from "@/lib/data/db";
import * as repo from "@/lib/data/projects";
import type { ProjectInput } from "@/lib/data/projects";
import { ServiceError } from "./errors";
import { logAudit } from "./audit";

export { ServiceError } from "./errors";

const FORBIDDEN = new ServiceError("forbidden", "You do not have permission to do that.");

function requireWrite(ctx: AppContext) {
  if (!ctx.emailVerified) throw new ServiceError("forbidden", "Please verify your email first. We sent you a link.");
  if (!canWrite(ctx.role)) throw FORBIDDEN;
}

export async function createProject(ctx: AppContext, input: ProjectInput): Promise<string> {
  requireWrite(ctx);
  const db = await getDb();
  const id = await repo.insertProject(db, ctx.workspace.id, input);
  if (!id) throw new ServiceError("failed", "We could not create the project.");
  await logAudit(db, ctx, "project.created", "project", id, { name: input.name });
  return id;
}

export async function updateProject(ctx: AppContext, id: string, input: ProjectInput): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const ok = await repo.updateProject(db, ctx.workspace.id, id, input);
  if (!ok) throw new ServiceError("not_found", "That project could not be found.");
  await logAudit(db, ctx, "project.updated", "project", id, { name: input.name });
}

export async function setProjectArchived(ctx: AppContext, id: string, archived: boolean): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const ok = await repo.setProjectStatus(db, ctx.workspace.id, id, archived ? "archived" : "active");
  if (!ok) throw new ServiceError("not_found", "That project could not be found.");
  await logAudit(db, ctx, archived ? "project.archived" : "project.restored", "project", id, {});
}

export async function deleteProject(ctx: AppContext, id: string): Promise<void> {
  if (!canAdmin(ctx.role)) throw FORBIDDEN;
  const db = await getDb();
  const project = await repo.getProject(db, ctx.workspace.id, id);
  if (!project) throw new ServiceError("not_found", "That project could not be found.");
  try {
    const ok = await repo.deleteProject(db, ctx.workspace.id, id);
    if (!ok) throw new ServiceError("not_found", "That project could not be found.");
  } catch (error) {
    if (error instanceof DataError && error.code === "23503") {
      throw new ServiceError("in_use", "This project has campaigns or posts. Archive it instead.");
    }
    throw error;
  }
  await logAudit(db, ctx, "project.deleted", "project", id, { name: project.name });
}

