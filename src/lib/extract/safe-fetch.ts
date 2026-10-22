import { Readable, pipeline } from "node:stream";
import zlib from "node:zlib";
import { ExtractError } from "./errors";
import { assertAllowedUrl, assertPublicAddresses, parseUserUrl } from "./url-safety";

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type TransportRequest = {
  url: URL;
  /** The already-validated IP to connect to. The transport must connect here and nowhere else. */
  address: string;
  family: 4 | 6;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type TransportResponse = {
  status: number;
  headers: Record<string, string>;
  body: AsyncIterable<Uint8Array>;
};

/** Sends one GET request. The real one uses node:http(s); tests use a fake. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type FetchPageOptions = {
  transport: Transport;
  resolve: Resolver;
  userAgent: string;
  /** Largest allowed body, after decompression. */
  maxBytes?: number;
  maxRedirects?: number;
  /** Total time for DNS, redirects, and reading the body. */
  timeoutMs?: number;
  /** Allowed content types (the part before any semicolon). */
  acceptTypes?: RegExp;
  accept?: string;
  now?: () => number;
};

export type FetchedPage = {
  finalUrl: URL;
  status: number;
  contentType: string;
  text: string;
  redirects: number;
};

const DEFAULT_MAX_BYTES = 1_500_000;
const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)$/i;

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
}

function charsetFrom(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const sniff = new TextDecoder("latin1").decode(head.slice(0, 2048));
  return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(sniff)?.[1] ?? "utf-8";
}

function decodeBytes(bytes: Uint8Array, contentType: string): string {
  const label = charsetFrom(contentType, bytes);
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readBody(
  body: AsyncIterable<Uint8Array>,
  headers: Record<string, string>,
  maxBytes: number,
  deadline: number,
  now: () => number,
): Promise<Uint8Array> {
  const declared = Number(headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes && !headers["content-encoding"]) {
    throw new ExtractError("too_large");
  }

  // Count the compressed bytes too, so a tiny request cannot make us download endlessly.
  async function* limitedRaw(): AsyncGenerator<Uint8Array> {
    let raw = 0;
    for await (const chunk of body) {
      raw += chunk.byteLength;
      if (raw > maxBytes) throw new ExtractError("too_large");
      yield chunk;
    }
  }

  const encoding = (headers["content-encoding"] ?? "").toLowerCase().trim();
  let source: AsyncIterable<Uint8Array> = limitedRaw();
  if (encoding && encoding !== "identity") {
    const stream =
      encoding === "gzip" || encoding === "x-gzip"
        ? zlib.createGunzip()
        : encoding === "deflate"
          ? zlib.createInflate()
          : encoding === "br"
            ? zlib.createBrotliDecompress()
            : null;
    if (!stream) throw new ExtractError("source_error");
    // pipeline() forwards errors (such as "too large") to the decompressor so the read below fails cleanly.
    pipeline(Readable.from(limitedRaw()), stream, () => undefined);
    source = stream;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of source) {
      if (now() > deadline) throw new ExtractError("timeout");
      total += chunk.byteLength;
      if (total > maxBytes) throw new ExtractError("too_large");
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError("source_error");
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function statusToError(status: number): ExtractError | null {
  if (status >= 200 && status < 300) return null;
  if ([401, 402, 403, 407, 451].includes(status)) return new ExtractError("access_denied");
  if (status === 404 || status === 410) return new ExtractError("not_found");
  if (status === 429) return new ExtractError("rate_limited");
  return new ExtractError("source_error");
}

/**
 * Fetches one web page safely:
 *  - only public http(s) destinations; every redirect is checked again
 *  - DNS is resolved once, every address must be public, and the connection is pinned to that
 *    validated address (so a hostile DNS server cannot switch it afterwards)
 *  - limits on redirects, time, and size; only expected content types; no JavaScript is run
 */
export async function fetchPage(rawUrl: string | URL, options: FetchPageOptions): Promise<FetchedPage> {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 12_000);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? 4;
  const acceptTypes = options.acceptTypes ?? HTML_TYPES;

  let url = typeof rawUrl === "string" ? parseUserUrl(rawUrl) : rawUrl;
  if (typeof rawUrl !== "string") assertAllowedUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (hop > 0) {
      try {
        assertAllowedUrl(url);
      } catch {
        throw new ExtractError("unsafe_redirect");
      }
    }

    let addresses: ResolvedAddress[];
    try {
      addresses = await Promise.race([
        options.resolve(url.hostname),
        new Promise<never>((_, reject) => setTimeout(() => reject(new ExtractError("timeout")), Math.max(1, deadline - now()))),
      ]);
    } catch (error) {
      throw error instanceof ExtractError ? error : new ExtractError("dns_failed");
    }
    assertPublicAddresses(addresses.map((a) => a.address));
    const target = addresses[0];
    if (!target) throw new ExtractError("dns_failed");

    const remaining = deadline - now();
    if (remaining <= 0) throw new ExtractError("timeout");

    let response: TransportResponse;
    try {
      response = await options.transport({
        url,
        address: target.address,
        family: target.family,
        timeoutMs: remaining,
        headers: {
          "user-agent": options.userAgent,
          accept: options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "en-US,en;q=0.8",
        },
      });
    } catch (error) {
      if (error instanceof ExtractError) throw error;
      const message = error instanceof Error ? error.message : "";
      throw new ExtractError(/timeout|timed out|aborted/i.test(message) ? "timeout" : "network");
    }

    const headers = lowerKeys(response.headers);

    if (response.status >= 300 && response.status < 400 && headers.location) {
      // Release the connection without reading the body.
      const iterator = response.body[Symbol.asyncIterator]();
      void iterator.return?.();
      if (hop === maxRedirects) throw new ExtractError("too_many_redirects");

      let next: URL;
      try {
        next = new URL(headers.location, url);
      } catch {
        throw new ExtractError("unsafe_redirect");
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") throw new ExtractError("unsafe_redirect");
      if (url.protocol === "https:" && next.protocol === "http:") throw new ExtractError("unsafe_redirect");
      next.hash = "";
      url = next;
      continue;
    }

    const failure = statusToError(response.status);
    if (failure) {
      const iterator = response.body[Symbol.asyncIterator]();
      void iterator.return?.();
      throw failure;
    }

    const contentType = (headers["content-type"] ?? "text/html").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!acceptTypes.test(contentType)) {
      const iterator = response.body[Symbol.asyncIterator]();
      void iterator.return?.();
      throw new ExtractError("unsupported_type");
    }

    const bytes = await readBody(response.body, headers, maxBytes, deadline, now);
    return {
      finalUrl: url,
      status: response.status,
      contentType,
      text: decodeBytes(bytes, headers["content-type"] ?? ""),
      redirects: hop,
    };
  }

  throw new ExtractError("too_many_redirects");
}
