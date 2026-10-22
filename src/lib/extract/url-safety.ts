import { isIP } from "node:net";
import { ExtractError } from "./errors";
import { isPrivateIp } from "./ip";

const MAX_URL_LENGTH = 2000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".intranet",
  ".private",
  ".localdomain",
];

/** Rejects hostnames that point at our own machine or private networks by name. */
export function assertPublicHostname(rawHostname: string): void {
  const hostname = rawHostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 253) throw new ExtractError("invalid_url");

  // IP addresses (including IPv6 in brackets) are never accepted: real sites use names.
  if (hostname.startsWith("[") || isIP(hostname) !== 0) throw new ExtractError("blocked_destination");

  if (hostname === "localhost" || !hostname.includes(".")) throw new ExtractError("blocked_destination");
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) throw new ExtractError("blocked_destination");
  if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.split(".").some((label) => label.length === 0 || label.length > 63)) {
    throw new ExtractError("invalid_url");
  }
}

/** Checks an already-parsed URL (used for the first request and for every redirect). */
export function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ExtractError("unsupported_scheme");
  if (url.username || url.password) throw new ExtractError("blocked_destination");
  if (!ALLOWED_PORTS.has(url.port)) throw new ExtractError("blocked_destination");
  assertPublicHostname(url.hostname);
}

/** Parses what a user typed. Adds https:// when no scheme is given. */
export function parseUserUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new ExtractError("invalid_url");
  if ([...trimmed].some((ch) => ch.charCodeAt(0) <= 32 || ch.charCodeAt(0) === 127)) throw new ExtractError("invalid_url");

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ExtractError("invalid_url");
  }
  assertAllowedUrl(url);
  url.hash = "";
  return url;
}

/** Every address a hostname resolves to must be public; one private answer blocks the request. */
export function assertPublicAddresses(addresses: string[]): void {
  if (addresses.length === 0) throw new ExtractError("dns_failed");
  if (addresses.some((address) => isPrivateIp(address))) throw new ExtractError("blocked_destination");
}
