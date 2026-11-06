import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import type { ContactInput, SupportStatus, SupportTopic } from "@/lib/support";

/** Support inbox queries. Browsers have no access to this table; only server code (service key) reads or writes it. */

export type SupportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  topic: SupportTopic;
  subject: string;
  message: string;
  user_id: string | null;
  status: SupportStatus;
  admin_note: string;
  replied_at: string | null;
};

const COLUMNS = "id, created_at, updated_at, name, email, topic, subject, message, user_id, status, admin_note, replied_at";

/** The spam guard (see migration 0023). Failing to ask is treated as "not allowed" so a broken guard never opens the door. */
export async function canSubmitMessage(ipHash: string, email: string): Promise<boolean> {
  const { data, error } = await adminDb().rpc("support_can_submit", { p_ip_hash: ipHash, p_email: email });
  if (error) throw new DataError("Could not check the message limit.", error.code);
  return data === true;
}

export async function insertMessage(input: ContactInput, ipHash: string): Promise<void> {
  const { error } = await adminDb().from("support_messages").insert({
    name: input.name,
    email: input.email,
    topic: input.topic,
    subject: input.subject,
    message: input.message,
    ip_hash: ipHash,
  });
  if (error) throw new DataError("Could not save the message.", error.code);
}

export async function listMessages(status: SupportStatus | "all", limit = 100): Promise<SupportRow[]> {
  let query = adminDb().from("support_messages").select(COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new DataError("Could not load the messages.", error.code);
  return (data ?? []) as SupportRow[];
}

export async function getMessage(id: string): Promise<SupportRow | null> {
  const { data, error } = await adminDb().from("support_messages").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new DataError("Could not load the message.", error.code);
  return (data as SupportRow | null) ?? null;
}

export async function countByStatus(): Promise<Record<SupportStatus, number>> {
  const out: Record<SupportStatus, number> = { new: 0, open: 0, closed: 0 };
  for (const status of Object.keys(out) as SupportStatus[]) {
    const { count, error } = await adminDb().from("support_messages").select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw new DataError("Could not count the messages.", error.code);
    out[status] = count ?? 0;
  }
  return out;
}

export async function countNewMessages(): Promise<number> {
  try {
    const { count, error } = await adminDb().from("support_messages").select("id", { count: "exact", head: true }).eq("status", "new");
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function setStatus(id: string, status: SupportStatus, adminId: string): Promise<void> {
  const { error } = await adminDb().from("support_messages").update({ status, handled_by: adminId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new DataError("Could not change the status.", error.code);
}

export async function setNote(id: string, note: string, adminId: string): Promise<void> {
  const { error } = await adminDb().from("support_messages").update({ admin_note: note, handled_by: adminId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new DataError("Could not save the note.", error.code);
}

/** After a reply was sent: remember when, and move a new message to "in progress" (a closed one stays closed). */
export async function markReplied(id: string, adminId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await adminDb().from("support_messages").update({ replied_at: now, handled_by: adminId, updated_at: now }).eq("id", id);
  if (error) throw new DataError("Could not record the reply.", error.code);
  await adminDb().from("support_messages").update({ status: "open" }).eq("id", id).eq("status", "new");
}

export async function cleanupClosedMessages(days: number): Promise<number> {
  const { data, error } = await adminDb().rpc("support_cleanup", { p_days: days });
  if (error) throw new DataError("Could not clean up old messages.", error.code);
  return typeof data === "number" ? data : Number(data ?? 0);
}
