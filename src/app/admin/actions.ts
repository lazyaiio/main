"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiError, describeAiError } from "@/lib/ai/errors";
import { createProviderInstance, hasApiKey } from "@/lib/ai/keys";
import { MODEL_NAME_PATTERN, PROVIDERS } from "@/lib/ai/registry";
import { PROVIDER_IDS } from "@/lib/ai/types";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { FormState } from "@/lib/auth/form-state";
import { firstError } from "@/lib/auth/schemas";
import { listProviderSettings, saveProviderSetting } from "@/lib/data/ai-settings";
import { getDb } from "@/lib/data/db";

const saveSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().trim().regex(MODEL_NAME_PATTERN, "Model names use letters, numbers, and . _ : / - only."),
  priority: z.coerce.number().int("Priority must be a whole number.").min(1, "Priority is 1 to 999.").max(999, "Priority is 1 to 999."),
  enabled: z.boolean(),
});

const providerOnly = z.object({ provider: z.enum(PROVIDER_IDS) });

export async function saveProviderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();

  const parsed = saveSchema.safeParse({
    provider: formData.get("provider"),
    model: formData.get("model"),
    priority: formData.get("priority"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { provider, model, priority, enabled } = parsed.data;

  if (enabled && !hasApiKey(provider)) {
    return {
      error: `No key found. Add ${PROVIDERS[provider].envVar} in your hosting environment variables, redeploy, then turn this provider on.`,
    };
  }

  const ok = await saveProviderSetting(await getDb(), provider, { enabled, model, priority });
  if (!ok) return { error: "Could not save. Please try again." };

  revalidatePath("/admin/ai-providers");
  return { success: true, message: "Saved." };
}

export async function testProviderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();

  const parsed = providerOnly.safeParse({ provider: formData.get("provider") });
  if (!parsed.success) return { error: "Unknown provider." };
  const { provider } = parsed.data;

  const instance = createProviderInstance(provider);
  if (!instance) return { error: `No key found. Add ${PROVIDERS[provider].envVar} first.` };

  const settings = (await listProviderSettings(await getDb())).find((s) => s.provider === provider);
  const model = settings?.model ?? PROVIDERS[provider].defaultModel;

  const started = Date.now();
  try {
    await instance.generate({
      system: "You are a connectivity test.",
      user: "Reply with the single word OK.",
      model,
      maxTokens: 20,
      json: false,
      timeoutMs: 20_000,
    });
    return { success: true, message: `Connected. The model answered in ${Date.now() - started} ms.` };
  } catch (error) {
    return { error: describeAiError(error instanceof AiError ? error.kind : "provider") };
  }
}
