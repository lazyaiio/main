import "server-only";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, WorkspaceRole, WorkspaceRow } from "@/lib/supabase/database.types";

export type AppContext = {
  user: User;
  profile: ProfileRow;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
};

/**
 * The signed-in user with their profile and personal workspace, or null when signed out
 * (or Supabase is not configured). Cached per request.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, membershipRes, workspaceRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("workspaces").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const profile = profileRes.data;
  // Supabase's inferred result can become `never` when generated database typings
  // and the installed client version disagree. Narrow the selected row to the
  // exact columns requested by this query; this does not change runtime behavior.
  const membership = membershipRes.data as { workspace_id: string; role: WorkspaceRole } | null;
  const workspace = workspaceRes.data;

  if (!profile || !membership || !workspace) {
    throw new Error("Your account setup is incomplete. Please try again or contact support.");
  }

  return { user, profile, workspace, role: membership.role };
});
