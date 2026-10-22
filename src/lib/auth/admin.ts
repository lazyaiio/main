import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/data/db";
import { isPlatformAdmin } from "@/lib/data/ai-settings";
import { requireAppContext, type AppContext } from "./session";

export const isCurrentUserPlatformAdmin = cache(async (): Promise<boolean> => {
  return isPlatformAdmin(await getDb());
});

/** Admin pages: signed in AND a platform admin. Everyone else sees a plain 404. */
export async function requirePlatformAdmin(): Promise<AppContext> {
  const ctx = await requireAppContext();
  if (!(await isCurrentUserPlatformAdmin())) return notFound();
  return ctx;
}
