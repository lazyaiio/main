import { listPublished } from "@/lib/data/blog";
import { siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The newest 30 articles as an RSS feed. */
export async function GET() {
  const base = siteBase();
  const { posts } = await listPublished({ perPage: 30 });
  const items = posts
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${base}/blog/${p.slug}</link><guid isPermaLink="true">${base}/blog/${p.slug}</guid>${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}<description>${esc(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>The LazyAI Blog</title><link>${base}/blog</link><description>Practical guides on planning, writing, and scheduling Facebook Page posts.</description><language>en-us</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
