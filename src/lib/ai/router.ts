import { AiError, isRetryable, type AiErrorKind } from "./errors";
import type { GenerateRequest, GenerateResult, ProviderId, TextGenerationProvider } from "./types";

export type RouterProviderId = ProviderId | "mock";

export type EnabledProvider = { provider: RouterProviderId; model: string; priority: number };

export type RouterRequest = Omit<GenerateRequest, "model" | "timeoutMs">;

export type Attempt = { provider: RouterProviderId; kind: AiErrorKind | "ok" };

export type RouterResult = GenerateResult & {
  provider: RouterProviderId;
  model: string;
  attempts: Attempt[];
};

export type RouterOptions = {
  /** Providers to try, already filtered to those with a key. Lowest priority number goes first. */
  providers: EnabledProvider[];
  getProvider: (id: RouterProviderId) => TextGenerationProvider | null;
  /** Total time budget for the whole operation. */
  deadlineMs?: number;
  perAttemptTimeoutMs?: number;
  /** Extra tries per provider after the first (bounded). */
  maxRetries?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const MIN_ATTEMPT_MS = 4000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tries providers in priority order. Retryable failures are retried a bounded number of times with
 * backoff, then the next provider is tried. Authentication failures skip straight to the next one.
 */
export async function generateWithFallback(
  request: RouterRequest,
  options: RouterOptions,
): Promise<RouterResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = now() + (options.deadlineMs ?? 50_000);
  const perAttempt = options.perAttemptTimeoutMs ?? 25_000;
  const maxRetries = options.maxRetries ?? 1;
  const attempts: Attempt[] = [];

  const ordered = [...options.providers].sort((a, b) => a.priority - b.priority);
  let lastKind: AiErrorKind = "not_configured";

  for (const entry of ordered) {
    const impl = options.getProvider(entry.provider);
    if (!impl) continue;

    for (let tryNumber = 0; tryNumber <= maxRetries; tryNumber++) {
      const remaining = deadline - now();
      if (remaining < MIN_ATTEMPT_MS) {
        throw new AiError(lastKind === "not_configured" ? "timeout" : lastKind, "Out of time.");
      }
      try {
        const result = await impl.generate({
          ...request,
          model: entry.model,
          timeoutMs: Math.min(perAttempt, remaining),
        });
        attempts.push({ provider: impl.id, kind: "ok" });
        return { ...result, provider: impl.id, model: entry.model, attempts };
      } catch (error) {
        const kind: AiErrorKind = error instanceof AiError ? error.kind : "provider";
        lastKind = kind;
        attempts.push({ provider: impl.id, kind });
        if (!isRetryable(kind) || tryNumber === maxRetries) break;
        await sleep(Math.min(600 * 2 ** tryNumber, 2000));
      }
    }
  }

  throw new AiError(lastKind, "No provider could complete the request.");
}
