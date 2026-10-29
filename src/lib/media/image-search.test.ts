import { describe, expect, it } from "vitest";
import { PIXABAY_HOSTS, StockSearchError, cleanQuery, createPexelsProvider, createPixabayProvider, createUnsplashProvider, downloadImage } from "./image-search";

const photo = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  width: 4000,
  height: 3000,
  url: `https://www.pexels.com/photo/test-${id}/`,
  photographer: "Jane Doe",
  photographer_url: "https://www.pexels.com/@jane",
  alt: "A cup of coffee on a wooden table",
  src: {
    large2x: `https://images.pexels.com/photos/${id}/large2x.jpg`,
    large: `https://images.pexels.com/photos/${id}/large.jpg`,
    medium: `https://images.pexels.com/photos/${id}/medium.jpg`,
  },
  ...extra,
});

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => Promise.resolve(handler(String(input), init))) as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cleanQuery", () => {
  it("trims, collapses spaces, limits length, and rejects very short phrases", () => {
    expect(cleanQuery("  coffee   shop ")).toBe("coffee shop");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery("   ")).toBeNull();
    expect(cleanQuery("x".repeat(300))?.length).toBe(100);
  });
});

describe("Pexels provider", () => {
  it("sends the key and maps results with credit information", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const provider = createPexelsProvider(
      "KEY123",
      fakeFetch((url, init) => {
        seenUrl = url;
        seenAuth = String((init?.headers as Record<string, string>).Authorization);
        return json({ photos: [photo(1), photo(2)] });
      }),
    );
    const results = await provider.search("coffee shop", { perPage: 2 });
    expect(seenUrl).toContain("https://api.pexels.com/v1/search?query=coffee%20shop");
    expect(seenUrl).toContain("per_page=2");
    expect(seenAuth).toBe("KEY123");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ providerId: "1", providerName: "Pexels", creator: "Jane Doe", license: "Pexels License" });
    expect(results[0]?.downloadUrl).toBe("https://images.pexels.com/photos/1/large2x.jpg");
  });

  it("drops photos whose image addresses are not on the provider's host", async () => {
    const evil = photo(3, { src: { large2x: "https://evil.example.com/x.jpg", medium: "https://images.pexels.com/photos/3/medium.jpg" } });
    const http = photo(4, { src: { large2x: "http://images.pexels.com/photos/4/large2x.jpg", medium: "https://images.pexels.com/photos/4/medium.jpg" } });
    const provider = createPexelsProvider("k", fakeFetch(() => json({ photos: [evil, http, photo(5)] })));
    const results = await provider.search("coffee");
    expect(results.map((r) => r.providerId)).toEqual(["5"]);
  });

  it("limits page size and page number", async () => {
    let seen = "";
    const provider = createPexelsProvider("k", fakeFetch((url) => ((seen = url), json({ photos: [] }))));
    await provider.search("coffee", { perPage: 500, page: 99 });
    expect(seen).toContain("per_page=30");
    expect(seen).toContain("page=5");
  });

  it("reports a busy service, an outage, and a broken answer in plain English", async () => {
    const busy = createPexelsProvider("k", fakeFetch(() => json({}, 429)));
    await expect(busy.search("coffee")).rejects.toMatchObject({ code: "rate_limited" });
    const down = createPexelsProvider("k", fakeFetch(() => json({}, 500)));
    await expect(down.search("coffee")).rejects.toMatchObject({ code: "unavailable" });
    const broken = createPexelsProvider("k", fakeFetch(() => json({ nonsense: true })));
    await expect(broken.search("coffee")).rejects.toMatchObject({ code: "bad_response" });
    const offline = createPexelsProvider("k", (() => Promise.reject(new Error("network"))) as typeof fetch);
    await expect(offline.search("coffee")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("looks a photo up by a numeric id only", async () => {
    let calls = 0;
    const provider = createPexelsProvider("k", fakeFetch(() => ((calls += 1), json(photo(42)))));
    expect((await provider.getById("42"))?.providerId).toBe("42");
    expect(await provider.getById("42/../../etc")).toBeNull();
    expect(await provider.getById("abc")).toBeNull();
    expect(calls).toBe(1);
  });

  it("returns null for a photo that does not exist", async () => {
    const provider = createPexelsProvider("k", fakeFetch(() => json({}, 404)));
    expect(await provider.getById("99")).toBeNull();
  });
});

describe("downloadImage", () => {
  const options = { allowedHosts: ["images.pexels.com"], maxBytes: 1000 };

  it("downloads from an allowed host", async () => {
    const bytes = await downloadImage("https://images.pexels.com/a.jpg", { ...options, fetchFn: fakeFetch(() => new Response(new Uint8Array([1, 2, 3]))) });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("refuses other hosts, plain HTTP, credentials, odd ports, and IP addresses without calling out", async () => {
    let called = false;
    const fetchFn = fakeFetch(() => ((called = true), new Response("x")));
    for (const url of [
      "https://evil.example.com/a.jpg",
      "http://images.pexels.com/a.jpg",
      "https://user:pass@images.pexels.com/a.jpg",
      "https://images.pexels.com:8443/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://images.pexels.com.evil.example/a.jpg",
      "not a url",
    ]) {
      await expect(downloadImage(url, { ...options, fetchFn })).rejects.toBeInstanceOf(StockSearchError);
    }
    expect(called).toBe(false);
  });

  it("stops when the file is larger than the limit, by header or by actual size", async () => {
    const headerTooBig = fakeFetch(() => new Response(new Uint8Array(10), { headers: { "content-length": "999999" } }));
    await expect(downloadImage("https://images.pexels.com/a.jpg", { ...options, fetchFn: headerTooBig })).rejects.toMatchObject({ code: "download_failed" });
    const bodyTooBig = fakeFetch(() => new Response(new Uint8Array(5000)));
    await expect(downloadImage("https://images.pexels.com/a.jpg", { ...options, fetchFn: bodyTooBig })).rejects.toMatchObject({ code: "download_failed" });
  });

  it("reports failed downloads", async () => {
    await expect(downloadImage("https://images.pexels.com/a.jpg", { ...options, fetchFn: fakeFetch(() => new Response("no", { status: 403 })) })).rejects.toMatchObject({ code: "download_failed" });
    await expect(downloadImage("https://images.pexels.com/a.jpg", { ...options, fetchFn: (() => Promise.reject(new Error("x"))) as typeof fetch })).rejects.toMatchObject({ code: "download_failed" });
  });
});

describe("Pixabay", () => {
  const hit = (id: number) => ({
    id,
    pageURL: `https://pixabay.com/photos/test-${id}/`,
    tags: "coffee, cup, table",
    webformatURL: `https://pixabay.com/get/w${id}.jpg`,
    largeImageURL: `https://pixabay.com/get/l${id}.jpg`,
    imageWidth: 4000,
    imageHeight: 3000,
    user: "Some Person",
    user_id: 77,
  });

  it("maps results and credits the creator", async () => {
    const provider = createPixabayProvider("key12345", fakeFetch(() => json({ hits: [hit(5)] })));
    const [first] = await provider.search("coffee");
    expect(first).toMatchObject({ providerKey: "pixabay", providerId: "5", providerName: "Pixabay", license: "Pixabay Content License" });
    expect(first?.creatorUrl).toContain("/users/Some-Person-77/");
  });

  it("drops photos that are not on Pixabay's own hosts", async () => {
    const bad = { ...hit(6), largeImageURL: "https://evil.example/x.jpg" };
    const provider = createPixabayProvider("key12345", fakeFetch(() => json({ hits: [bad, hit(7)] })));
    expect((await provider.search("coffee")).map((p) => p.providerId)).toEqual(["7"]);
  });

  it("reports a busy provider and bad answers", async () => {
    await expect(createPixabayProvider("k", fakeFetch(() => new Response("", { status: 429 }))).search("x")).rejects.toMatchObject({ code: "rate_limited" });
    await expect(createPixabayProvider("k", fakeFetch(() => json({ nope: 1 }))).search("x")).rejects.toMatchObject({ code: "bad_response" });
  });

  it("follows a redirect only inside the provider's hosts", async () => {
    const opts = { allowedHosts: PIXABAY_HOSTS, maxBytes: 1000 };
    const ok = fakeFetch((url) => (url.includes("/get/") ? new Response("", { status: 302, headers: { location: "https://cdn.pixabay.com/photo/a.jpg" } }) : new Response(new Uint8Array([1, 2]))));
    expect((await downloadImage("https://pixabay.com/get/a.jpg", { ...opts, fetchFn: ok })).length).toBe(2);
    const bad = fakeFetch(() => new Response("", { status: 302, headers: { location: "https://evil.example/a.jpg" } }));
    await expect(downloadImage("https://pixabay.com/get/a.jpg", { ...opts, fetchFn: bad })).rejects.toMatchObject({ code: "not_allowed" });
  });
});

describe("Unsplash", () => {
  const result = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    width: 4000,
    height: 2600,
    alt_description: "a cup of coffee",
    urls: { regular: `https://images.unsplash.com/${id}?w=1080`, small: `https://images.unsplash.com/${id}?w=400` },
    links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download` },
    user: { name: "Jane Doe", username: "jane", links: { html: "https://unsplash.com/@jane" } },
    ...extra,
  });

  it("sends the key, maps results, and adds the tracking parameters to links", async () => {
    let auth = "";
    const provider = createUnsplashProvider("ACCESSKEY1", fakeFetch((_url, init) => {
      auth = String((init?.headers as Record<string, string>).Authorization);
      return json({ results: [result("abc12345")] });
    }));
    const [first] = await provider.search("coffee");
    expect(auth).toBe("Client-ID ACCESSKEY1");
    expect(first).toMatchObject({ providerKey: "unsplash", providerId: "abc12345", creator: "Jane Doe", license: "Unsplash License" });
    expect(first?.sourcePageUrl).toContain("utm_source=lazyai");
  });

  it("drops photos hosted anywhere else", async () => {
    const bad = result("evil1234", { urls: { regular: "https://evil.example/a.jpg", small: "https://evil.example/b.jpg" } });
    const provider = createUnsplashProvider("k", fakeFetch(() => json({ results: [bad, result("good1234")] })));
    expect((await provider.search("x")).map((p) => p.providerId)).toEqual(["good1234"]);
  });

  it("treats 403 and 429 as the hourly limit", async () => {
    await expect(createUnsplashProvider("k", fakeFetch(() => new Response("", { status: 403 }))).search("x")).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("reports a used photo to Unsplash", async () => {
    const calls: string[] = [];
    const provider = createUnsplashProvider("k", fakeFetch((url) => {
      calls.push(url);
      return json({ results: [result("abc12345")] });
    }));
    const [photo] = await provider.search("x");
    await provider.trackDownload?.(photo as NonNullable<typeof photo>);
    expect(calls[1]).toBe("https://api.unsplash.com/photos/abc12345/download");
  });
});
