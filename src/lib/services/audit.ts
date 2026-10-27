import "server-only";
import type { AppContext } from "@/lib/auth/session";
import type { Db } from "@/lib/data/db";
import { redactObject } from "@/lib/redact";

/**
 * Best-effort audit trail. Goes through a database function that checks membership and sets the
 * actor itself, so a client can never forge who did something. Pass names/ids only, never secrets.
 */
export async function logAudit(
  db: Db,
  ctx: AppContext,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await db.rpc("log_audit_event", {
      p_workspace_id: ctx.workspace.id,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_metadata: redactObject(metadata),
    });
  } catch {
    // The user's action already succeeded; an audit hiccup must not break it.
  }
}
