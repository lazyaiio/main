import "server-only";
import { PROVIDER_IDS, type ProviderId } from "@/lib/ai/types";
import type { EnabledProvider } from "@/lib/ai/router";
import type { Db } from "./db";
import { unwrap } from "./db";

export type ProviderSettingRow = {
  provider: ProviderId;
  enabled: boolean;
  model: string;
  priority: number;
  updated_at: string;
};

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);

export async function isPlatformAdmin(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("is_platform_admin");
  return !error && data === true;
}

export async function listEnabledProviders(db: Db): Promise<EnabledProvider[]> {
  const res = await db.rpc("get_enabled_ai_providers");
  const rows = (unwrap(res, "load AI settings") ?? []) as { provider: string; model: string; priority: number }[];
  return rows
    .filter((r) => isProviderId(r.provider))
    .map((r) => ({ provider: r.provider as ProviderId, model: r.model, priority: r.priority }));
}

export async function listProviderSettings(db: Db): Promise<ProviderSettingRow[]> {
  const res = await db
    .from("ai_provider_settings")
    .select("provider, enabled, model, priority, updated_at")
    .order("priority", { ascending: true });
  return ((unwrap(res, "load AI settings") ?? []) as ProviderSettingRow[]).filter((r) => isProviderId(r.provider));
}

export async function saveProviderSetting(
  db: Db,
  provider: ProviderId,
  values: { enabled: boolean; model: string; priority: number },
): Promise<boolean> {
  const res = await db
    .from("ai_provider_settings")
    .update({ enabled: values.enabled, model: values.model, priority: values.priority })
    .eq("provider", provider)
    .select("provider");
  return ((unwrap(res, "save AI settings") as unknown[] | null) ?? []).length === 1;
}

export async function recordAiUsage(
  db: Db,
  args: {
    workspaceId: string;
    actionType: string;
    provider: string;
    model: string;
    units: number;
    entityType?: string;
    entityId?: string;
  },
): Promise<void> {
  const { error } = await db.rpc("record_ai_usage", {
    p_workspace_id: args.workspaceId,
    p_action_type: args.actionType,
    p_provider: args.provider,
    p_model: args.model,
    p_units: args.units,
    p_entity_type: args.entityType ?? null,
    p_entity_id: args.entityId ?? null,
  });
  if (error) throw new Error("Could not record usage.");
}

export async function countRecentAiUsage(db: Db, workspaceId: string, userId: string, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from("usage_records")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .like("action_type", "ai.%")
    .gte("created_at", sinceIso);
  if (error) throw new Error("Could not check usage.");
  return count ?? 0;
}
