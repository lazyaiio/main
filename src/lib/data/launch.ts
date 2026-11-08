import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import { cleanDone, isManualId } from "@/lib/launch-checklist";

const KEY = "launch_checklist";

export async function readLaunchDone(): Promise<Record<string, string>> {
  try {
    const { data, error } = await adminDb().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    if (error || !data) return {};
    return cleanDone((data as { value?: { done?: unknown } }).value?.done);
  } catch {
    return {};
  }
}

/** Marks one manual item done (now) or not done. Only known manual items are accepted. */
export async function setLaunchItem(id: string, done: boolean, userId: string): Promise<void> {
  if (!isManualId(id)) throw new DataError("Unknown checklist item.");
  const current = await readLaunchDone();
  if (done) current[id] = new Date().toISOString();
  else delete current[id];
  const { error } = await adminDb().from("platform_settings").upsert({ key: KEY, value: { done: current }, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the checklist.", error.code);
}
