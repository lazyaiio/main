import "server-only";
import { readNotice, writeNotice } from "@/lib/data/notices";
import { DEFAULT_NOTICE, type SiteNotice } from "@/lib/notices";

/** The banner and maintenance switch are read at most every 30 seconds per server instance (saving clears this instance at once). */
let cache: { at: number; notice: SiteNotice } | null = null;

export async function loadNotice(): Promise<SiteNotice> {
  if (cache && Date.now() - cache.at < 30_000) return cache.notice;
  try {
    const notice = await readNotice();
    cache = { at: Date.now(), notice };
    return notice;
  } catch {
    return DEFAULT_NOTICE;
  }
}

export async function saveNotice(notice: SiteNotice, userId: string): Promise<void> {
  await writeNotice(notice, userId);
  cache = null;
}
