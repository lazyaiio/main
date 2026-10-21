import type { WorkspaceRole } from "@/lib/supabase/database.types";

/** Owners, admins and editors may create and change content. Viewers are read-only. */
export function canWrite(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/** Owners and admins may delete projects and manage the workspace. */
export function canAdmin(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}
