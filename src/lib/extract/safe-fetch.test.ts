import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { ExtractError } from "./errors";
import { fetchPage, type Resolver, type Transport, type TransportRequest } from "./safe-fetch";

const PUBLIC: Resolver = async () => [{ address: "93.184.216.34", family: 4 }];

type Reply = { status?: number; headers?: Record<string, string>; body?: string | Buffer | AsyncIterable<Uint8Array> };

function transportFor(routes: Record<string, Reply>, seen: TransportRequest[] = []): Transport {
  return async (req) => {
    seen.push(req);
    const reply = routes[req.url.href];
    if (!reply) throw new Error("no route for " + req.url.href);
    const raw = reply.body ?? "";
    const body: AsyncIterable<Uint8Array> =
      typeof raw === "string" || Buffer.isBuffer(raw)
        ? (async function* () {
            yield typeof raw === "string" ? Buffer.from(raw) : raw;
          })()
        : raw;
    return { status: reply.status ?? 200, headers: { "content-type": "text/html; charset=utf-8", ...reply.headers }, body };
  };
}

const base = { resolve: PUBLIC, userAgent: "TestBot/1.0" };

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    return error instanceof ExtractError ? error.kind : `other:${(error as Error).message}`;
  }
}

describe("fetchPage", () => {
  it("fetches a page, pinning the connection to the validated address", async () => {
    const seen: TransportRequest[] = [];
    const page = await fetchPage("https://example.com/a", {
      ...base,
      transport: transportFor({ "https://example.com/a": { body: "<p>hello</p>" } }, seen),
    });
    expect(page.text).toBe("<p>hello</p>");
    expect(page.finalUrl.href).toBe("https://example.com/a");
    expect(seen[0]?.address).toBe("93.184.216.34");
    expect(seen[0]?.headers["user-agent"]).toBe("TestBot/1.0");
  });

  it("follows a safe redirect, including relative ones", async () => {
    const page = await fetchPage("https://example.com/old", {
      ...base,
      transport: transportFor({
        "https://example.com/old": { status: 301, headers: { location: "/new" } },
        "https://example.com/new": { body: "ok" },
      }),
    });
    expect(page.finalUrl.href).toBe("https://example.com/new");
    expect(page.redirects).toBe(1);
  });

  it("blocks a redirect to a private or local destination", async () => {
    for (const location of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://localhost/", "http://intranet/x", "file:///etc/passwd", "javascript:alert(1)"]) {
      const kind = await kindOf(
        fetchPage("https://example.com/r", {
          ...base,
          transport: transportFor({ "https://example.com/r": { status: 302, headers: { location } } }),
        }),
      );
      expect(kind).toBe("unsafe_redirect");
    }
  });

  it("blocks a redirect whose hostname resolves to a private address", async () => {
    const resolve: Resolver = async (host) => (host === "sneaky.example.org" ? [{ address: "10.0.0.8", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]);
    const kind = await kindOf(
      fetchPage("https://example.com/r", {
        ...base,
        resolve,
        transport: transportFor({ "https://example.com/r": { status: 302, headers: { location: "https://sneaky.example.org/" } } }),
      }),
    );
    expect(kind).toBe("blocked_destination");
  });

  it("blocks https to http downgrades", async () => {
    const kind = await kindOf(
      fetchPage("https://example.com/r", {
        ...base,
        transport: transportFor({ "https://example.com/r": { status: 302, headers: { location: "http://example.com/plain" } } }),
      }),
    );
    expect(kind).toBe("unsafe_redirect");
  });

  it("stops redirect loops", async () => {
    const kind = await kindOf(
      fetchPage("https://example.com/a", {
        ...base,
        transport: transportFor({
          "https://example.com/a": { status: 302, headers: { location: "/b" } },
          "https://example.com/b": { status: 302, headers: { location: "/a" } },
        }),
      }),
    );
    expect(kind).toBe("too_many_redirects");
  });

  it("blocks when DNS returns a private address, even mixed with public ones", async () => {
    const resolve: Resolver = async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
    expect(await kindOf(fetchPage("https://example.com/", { ...base, resolve, transport: transportFor({}) }))).toBe("blocked_destination");
  });

  it("reports DNS failures", async () => {
    const resolve: Resolver = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await kindOf(fetchPage("https://example.com/", { ...base, resolve, transport: transportFor({}) }))).toBe("dns_failed");
  });

  it("rejects oversized pages, by header and by streamed size", async () => {
    const byHeader = await kindOf(
      fetchPage("https://example.com/big", {
        ...base,
        maxBytes: 100,
        transport: transportFor({ "https://example.com/big": { headers: { "content-length": "5000" }, body: "x" } }),
      }),
    );
    expect(byHeader).toBe("too_large");

    async function* endless() {
      for (let i = 0; i < 100; i++) yield Buffer.from("x".repeat(50));
    }
    const streamed = await kindOf(
      fetchPage("https://example.com/big", { ...base, maxBytes: 200, transport: transportFor({ "https://example.com/big": { body: endless() } }) }),
    );
    expect(streamed).toBe("too_large");
  });

  it("limits decompressed size so a small compressed file cannot explode", async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(5_000_000, 97));
    const kind = await kindOf(
      fetchPage("https://example.com/bomb", {
        ...base,
        maxBytes: 100_000,
        transport: transportFor({ "https://example.com/bomb": { headers: { "content-encoding": "gzip" }, body: bomb } }),
      }),
    );
    expect(kind).toBe("too_large");
  });

  it("decodes gzip pages", async () => {
    const page = await fetchPage("https://example.com/z", {
      ...base,
      transport: transportFor({ "https://example.com/z": { headers: { "content-encoding": "gzip" }, body: zlib.gzipSync(Buffer.from("<p>zipped</p>")) } }),
    });
    expect(page.text).toBe("<p>zipped</p>");
  });

  it("only accepts web page content types", async () => {
    for (const type of ["application/pdf", "image/png", "application/octet-stream", "video/mp4"]) {
      const kind = await kindOf(fetchPage("https://example.com/f", { ...base, transport: transportFor({ "https://example.com/f": { headers: { "content-type": type }, body: "x" } }) }));
      expect(kind).toBe("unsupported_type");
    }
  });

  it("maps HTTP statuses to clear errors", async () => {
    const cases: [number, string][] = [[401, "access_denied"], [403, "access_denied"], [402, "access_denied"], [404, "not_found"], [410, "not_found"], [429, "rate_limited"], [500, "source_error"], [503, "source_error"]];
    for (const [status, expected] of cases) {
      const kind = await kindOf(fetchPage("https://example.com/s", { ...base, transport: transportFor({ "https://example.com/s": { status } }) }));
      expect(kind).toBe(expected);
    }
  });

  it("maps transport failures to timeout or network errors", async () => {
    const timeout: Transport = async () => {
      throw new Error("request timed out");
    };
    const broken: Transport = async () => {
      throw new Error("ECONNRESET");
    };
    expect(await kindOf(fetchPage("https://example.com/", { ...base, transport: timeout }))).toBe("timeout");
    expect(await kindOf(fetchPage("https://example.com/", { ...base, transport: broken }))).toBe("network");
  });

  it("enforces the total time budget while reading", async () => {
    let clock = 0;
    async function* slow() {
      yield Buffer.from("a");
      clock += 20_000;
      yield Buffer.from("b");
    }
    const kind = await kindOf(
      fetchPage("https://example.com/slow", { ...base, now: () => clock, timeoutMs: 5000, transport: transportFor({ "https://example.com/slow": { body: slow() } }) }),
    );
    expect(kind).toBe("timeout");
  });

  it("decodes the declared charset", async () => {
    const latin = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "café" in latin1
    const page = await fetchPage("https://example.com/l", {
      ...base,
      transport: transportFor({ "https://example.com/l": { headers: { "content-type": "text/html; charset=iso-8859-1" }, body: latin } }),
    });
    expect(page.text).toBe("caf\u00e9");
  });

  it("rejects unsafe starting addresses before any network call", async () => {
    let called = false;
    const transport: Transport = async () => {
      called = true;
      throw new Error("should not be called");
    };
    expect(await kindOf(fetchPage("http://127.0.0.1/", { ...base, transport }))).toBe("blocked_destination");
    expect(called).toBe(false);
  });
});
