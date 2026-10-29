"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { FormState } from "@/lib/auth/form-state";
import { encryptToken } from "@/lib/crypto/token-crypto";
import { readStockSettings, writeStockSettings } from "@/lib/data/stock-settings";
import { StockSearchError } from "@/lib/media/image-search";
import { loadStockProviders, stockKeyContext } from "@/lib/media/stock-providers";
import { getTokenEncryptionKey } from "@/lib/social/keys";

const providerSchema = z.enum(["pexels", "pixabay", "unsplash"]);
const keySchema = z.string().trim().min(8, "That key looks too short.").max(200, "That key looks too long.").regex(/^[A-Za-z0-9_\-:.]+$/, "A key has only letters, numbers, and - _ : . characters.");

export async function saveStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePlatformAdmin();
  const provider = providerSchema.safeParse(formData.get("provider"));
  if (!provider.success) return { error: "Unknown provider." };
  const key = provider.data;
  const intent = formData.get("intent");
  const rawKey = formData.get(`apiKey-${key}`);
  const enabled = formData.get("enabled") === "on";

  const settings = await readStockSettings();
  if (intent === "remove") {
    settings[key] = { enabled: false, keyEncrypted: null };
  } else {
    let keyEncrypted = settings[key].keyEncrypted;
    if (typeof rawKey === "string" && rawKey.trim()) {
      const parsed = keySchema.safeParse(rawKey);
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That key is not valid." };
      const secret = getTokenEncryptionKey();
      if (!secret) return { error: "TOKEN_ENCRYPTION_KEY is not set in Vercel, so keys cannot be stored safely. Add it (32 or more random characters), redeploy, then try again." };
      keyEncrypted = encryptToken(secret, stockKeyContext(key), parsed.data);
    }
    if (enabled && !keyEncrypted) return { error: "Paste an API key before turning this provider on." };
    settings[key] = { enabled, keyEncrypted };
  }
  try {
    await writeStockSettings(settings, ctx.user.id);
  } catch {
    return { error: "Could not save. Check that migration 0011 was run and the Supabase service key is set." };
  }
  revalidatePath("/admin/stock-photos");
  return { success: true, message: intent === "remove" ? "Key removed." : "Saved." };
}

export async function testStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const provider = providerSchema.safeParse(formData.get("provider"));
  if (!provider.success) return { error: "Unknown provider." };
  const instance = (await loadStockProviders()).find((p) => p.id === provider.data);
  if (!instance) return { error: "This provider is off or has no key yet. Save the key and turn it on first." };
  try {
    const photos = await instance.search("coffee shop", { perPage: 5 });
    return photos.length > 0 ? { success: true, message: `Working. The search returned ${photos.length} photos.` } : { error: "The key was accepted but the search returned no photos." };
  } catch (error) {
    return { error: error instanceof StockSearchError ? error.message : "The test failed. Check the key." };
  }
}
