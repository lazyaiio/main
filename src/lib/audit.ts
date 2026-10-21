import type { AuditEventRow } from "@/lib/data/types";

const verbs: Record<string, string> = {
  "project.created": "Created project",
  "project.updated": "Updated project",
  "project.archived": "Archived project",
  "project.restored": "Restored project",
  "project.deleted": "Deleted project",
};

/** Human-readable one-liner for an audit event. Unknown actions fall back to the raw action name. */
export function describeAuditEvent(event: Pick<AuditEventRow, "action" | "metadata">): string {
  const verb = verbs[event.action] ?? event.action.replace(/[._]/g, " ");
  const name = typeof event.metadata?.name === "string" ? event.metadata.name : "";
  return name ? `${verb} “${name}”` : verb;
}
