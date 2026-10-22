import "server-only";
import { getPublicEnv } from "@/lib/env";
import { PROVIDERS } from "./registry";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAiProvider } from "./providers/openai";
import { createOpenRouterProvider } from "./providers/openrouter";
import type { ProviderId, TextGenerationProvider } from "./types";

/** The ONLY place AI API keys are read. Keys come from environment variables, never the database. */
export function getApiKey(provider: ProviderId): string | null {
  const value = process.env[PROVIDERS[provider].envVar]?.trim();
  return value ? value : null;
}

export function hasApiKey(provider: ProviderId): boolean {
  return getApiKey(provider) !== null;
}

/** Fake AI for trying the app without a key. Never active in production. */
export function isMockEnabled(): boolean {
  return process.env.AI_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

export function getMaxGenerationsPerHour(): number {
  const parsed = Number.parseInt(process.env.AI_MAX_GENERATIONS_PER_HOUR ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : 30;
}

export function createProviderInstance(id: ProviderId): TextGenerationProvider | null {
  const key = getApiKey(id);
  if (!key) return null;
  switch (id) {
    case "anthropic":
      return createAnthropicProvider(key);
    case "openai":
      return createOpenAiProvider(key);
    case "gemini":
      return createGeminiProvider(key);
    case "openrouter":
      return createOpenRouterProvider(key, getPublicEnv().NEXT_PUBLIC_APP_URL);
  }
}
