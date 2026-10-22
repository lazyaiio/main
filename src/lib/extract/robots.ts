import { ExtractError } from "./errors";
import { fetchPage, type FetchPageOptions } from "./safe-fetch";

export type RobotsRules = { allows(pathWithQuery: string): boolean };

type Rule = { allow: boolean; pattern: string };

const MAX_LINES = 2000;
const MAX_PATTERN_LENGTH = 200;
const MAX_WILDCARDS = 5;

function patternToRegex(pattern: string): RegExp | null {
  if (pattern.length > MAX_PATTERN_LENGTH || (pattern.match(/\*/g)?.length ?? 0) > MAX_WILDCARDS) return null;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Parses robots.txt for one crawler name (for example "lazyaibot"). Falls back to the * group. */
export function parseRobots(text: string, agentToken: string): RobotsRules {
  const token = agentToken.toLowerCase();
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/).slice(0, MAX_LINES)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ allow: field === "allow", pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && a === token));
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules).filter((r) => r.pattern !== "");

  return {
    allows(pathWithQuery: string): boolean {
      let best: { length: number; allow: boolean } | null = null;
      for (const rule of rules) {
        const regex = patternToRegex(rule.pattern);
        if (!regex || !regex.test(pathWithQuery)) continue;
        const length = rule.pattern.length;
        if (!best || length > best.length || (length === best.length && rule.allow)) {
          best = { length, allow: rule.allow };
        }
      }
      return best ? best.allow : true;
    },
  };
}

/**
 * Fetches and applies the site's robots.txt (through the same safe fetcher).
 * Missing or forbidden robots.txt (4xx) means no restrictions. If it cannot be checked
 * (server error, timeout, network), we do not read the page.
 */
export async function assertRobotsAllow(
  target: URL,
  agentToken: string,
  options: Omit<FetchPageOptions, "acceptTypes" | "maxBytes" | "timeoutMs" | "accept">,
): Promise<void> {
  const robotsUrl = new URL("/robots.txt", target.origin);
  let body: string;
  try {
    const page = await fetchPage(robotsUrl, {
      ...options,
      acceptTypes: /^text\//i,
      accept: "text/plain,*/*;q=0.1",
      maxBytes: 200_000,
      timeoutMs: 4_000,
    });
    body = page.text;
  } catch (error) {
    if (error instanceof ExtractError) {
      if (error.kind === "not_found" || error.kind === "access_denied") return;
      if (error.kind === "blocked_destination" || error.kind === "unsafe_redirect") throw error;
    }
    throw new ExtractError("robots_unavailable");
  }

  if (!parseRobots(body, agentToken).allows(target.pathname + target.search)) {
    throw new ExtractError("robots_disallowed");
  }
}
