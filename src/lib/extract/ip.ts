import { isIP } from "node:net";

export function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.some((n) => Number.isNaN(n) || n > 255) ? null : nums;
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a = 0, b = 0, c = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // "this" network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local, including cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // protocol assignments, documentation
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // documentation
  if (a === 203 && b === 0 && c === 113) return true; // documentation
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Expands an IPv6 address into eight 16-bit groups, or returns null when it is malformed. */
export function expandIpv6(input: string): number[] | null {
  let text = input.toLowerCase();
  if (text.includes("%")) return null;

  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const high = (((v4[0] ?? 0) << 8) | (v4[1] ?? 0)).toString(16);
    const low = (((v4[2] ?? 0) << 8) | (v4[3] ?? 0)).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 1) {
    groups = head;
  } else {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  }
  if (groups.length !== 8) return null;

  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some((n) => Number.isNaN(n)) ? null : nums;
}

function embeddedV4(high: number, low: number): number[] {
  return [high >> 8, high & 255, low >> 8, low & 255];
}

/**
 * True when an address is not safe to connect to from our servers: loopback, private,
 * link-local (cloud metadata), multicast, reserved, documentation, or anything we cannot parse.
 * Anything that is not clearly a public address is treated as unsafe.
 */
export function isPrivateIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = parseIpv4(address);
    return parts ? isPrivateIpv4(parts) : true;
  }
  if (family === 6) {
    const g = expandIpv6(address);
    if (!g) return true;
    const first = g[0] ?? 0;

    if (g.every((x) => x === 0)) return true; // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
    if (g.slice(0, 6).every((x) => x === 0)) return true; // IPv4-compatible (deprecated)
    if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
    if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
    if ((first & 0xffc0) === 0xfec0) return true; // site-local (deprecated)
    if ((first & 0xff00) === 0xff00) return true; // multicast

    // IPv4-mapped ::ffff:a.b.c.d
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateIpv4(embeddedV4(g[6] ?? 0, g[7] ?? 0));
    // NAT64 64:ff9b::/96
    if (first === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateIpv4(embeddedV4(g[6] ?? 0, g[7] ?? 0));
    // 6to4 2002::/16 embeds an IPv4 address
    if (first === 0x2002) return isPrivateIpv4(embeddedV4(g[1] ?? 0, g[2] ?? 0));
    // Teredo 2001:0000::/32 and documentation 2001:db8::/32
    if (first === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return true;
    return false;
  }
  return true;
}
