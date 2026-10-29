import type { ProviderId } from "./types";

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  envVar: string;
  defaultModel: string;
  note: string;
};

/** Static facts about each supported provider. Models are editable in the admin section. */
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-5-5",
    note: "Paid API. Strong writing quality.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    note: "Paid API.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    note: "May include a free tier. Check Google AI Studio for current limits.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    defaultModel: "openrouter/free",
    note: "One key for many models. Use openrouter/free to let OpenRouter pick a working free model for each request (free model names change often, so a fixed name can stop working without notice).",
  },
};

export const MODEL_NAME_PATTERN = /^[A-Za-z0-9._:/-]{1,120}$/;
