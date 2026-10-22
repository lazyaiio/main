import { AiError } from "./errors";
import type { FetchLike } from "./types";

/** POST JSON and return the parsed body. Maps every failure to a safe AiError. */
export async function postJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new AiError("timeout", "Request timed out.");
    throw new AiError("network", "Network error.");
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new AiError("auth", "Authentication failed.", status);
    if (status === 429) throw new AiError("rate_limit", "Rate limited.", status);
    if (status >= 500) throw new AiError("provider", "Provider error.", status);
    throw new AiError("bad_response", "Request rejected.", status);
  }

  try {
    return await response.json();
  } catch {
    throw new AiError("bad_response", "Unreadable response.");
  }
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
