/** Campaign link (UTM) builder (pure). */

export type UtmInput = { url: string; source: string; medium: string; campaign: string; term: string; content: string };
export type UtmResult = { ok: true; url: string; added: string[] } | { ok: false; error: string };

/** Lowercase, spaces become hyphens, and only letters, digits, hyphen, underscore, and dot stay. */
export function cleanUtmValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_.]/g, "").slice(0, 100);
}

export function buildUtmUrl(input: UtmInput): UtmResult {
  const raw = input.url.trim();
  if (!raw) return { ok: false, error: "Paste the web address you want to link to." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That does not look like a web address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "Use an address that starts with http:// or https://." };
  if (!url.hostname.includes(".")) return { ok: false, error: "That web address needs a domain, such as example.com." };

  const source = cleanUtmValue(input.source);
  const medium = cleanUtmValue(input.medium);
  const campaign = cleanUtmValue(input.campaign);
  if (!source) return { ok: false, error: "Add a source, for example facebook." };
  if (!medium) return { ok: false, error: "Add a medium, for example social." };
  if (!campaign) return { ok: false, error: "Add a campaign name, for example spring-sale." };

  const params: [string, string][] = [["utm_source", source], ["utm_medium", medium], ["utm_campaign", campaign]];
  const term = cleanUtmValue(input.term);
  const content = cleanUtmValue(input.content);
  if (term) params.push(["utm_term", term]);
  if (content) params.push(["utm_content", content]);

  // Replace any UTM values already in the link, keep every other parameter and the #section.
  for (const key of Array.from(url.searchParams.keys())) if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  for (const [k, v] of params) url.searchParams.append(k, v);
  return { ok: true, url: url.toString(), added: params.map(([k]) => k) };
}
