import { SocialError, describeSocialError, type MetricResult, type PageGrant, type PostMetricsResult, type SocialPublishingProvider } from "./provider";

/**
 * A pretend Facebook for trying the product without a Meta app. No network, no real accounts.
 * Three Pages: two you can post to and one where you only have an analyst role (cannot post).
 */
export const MOCK_CODE = "mock-code";

const MOCK_PAGES: Omit<PageGrant, "accessToken">[] = [
  { id: "100000000000001", name: "Mock Bakery", category: "Bakery", tasks: ["CREATE_CONTENT", "MANAGE"], canPublish: true },
  { id: "100000000000002", name: "Mock Studio", category: "Photographer", tasks: ["CREATE_CONTENT"], canPublish: true },
  { id: "100000000000003", name: "Mock Analyst Page", category: "Community", tasks: ["ANALYZE"], canPublish: false },
];

export function createMockProvider(): SocialPublishingProvider {
  return {
    id: "mock",
    requiredScopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],

    buildAuthorizationUrl({ state, redirectUri }) {
      const url = new URL(redirectUri);
      url.searchParams.set("code", MOCK_CODE);
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCode({ code }) {
      if (code !== MOCK_CODE) throw new SocialError("denied", describeSocialError("denied"));
      return { accessToken: "mock-user-token-0000000000" };
    },

    async extendUserToken(token) {
      return { accessToken: `${token}-long` };
    },

    async inspectToken() {
      return {
        valid: true,
        userId: "mock-user-1",
        scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights"],
        expiresAt: null,
        dataAccessExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };
    },

    async listPages() {
      return {
        user: { id: "mock-user-1", name: "Mock User" },
        pages: MOCK_PAGES.map((page) => ({ ...page, accessToken: `mock-page-token-${page.id}` })),
      };
    },

    async checkPage(page) {
      if (page.accessToken.includes("expired")) throw new SocialError("token_expired", describeSocialError("token_expired"));
      const known = MOCK_PAGES.find((p) => p.id === page.id);
      if (!known) throw new SocialError("page_access_lost", describeSocialError("page_access_lost"));
      return { name: known.name };
    },

    async getPageSummary(page) {
      if (!MOCK_PAGES.some((p) => p.id === page.id)) throw new SocialError("page_access_lost", describeSocialError("page_access_lost"));
      return { followers: 1240, likes: 1190 };
    },

    /** Pretend numbers that always come out the same, so the Insights screens can be tried without Facebook. */
    async getPageMetric(page, metric, since, until): Promise<MetricResult> {
      if (page.accessToken.includes("expired")) throw new SocialError("token_expired", describeSocialError("token_expired"));
      if (metric === "page_total_actions") return { points: [], problem: "unavailable" };
      const seed = [...`${page.id}${metric}`].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
      const points: { date: string; value: number }[] = [];
      for (let ms = since.getTime(), i = 0; ms < until.getTime(); ms += 86_400_000, i += 1) {
        points.push({ date: new Date(ms).toISOString().slice(0, 10), value: 20 + ((seed + i * 37) % 60) + (i > 14 ? 15 : 0) });
      }
      return { points, problem: null };
    },

    async getPostMetrics(_page, postId, metrics): Promise<PostMetricsResult> {
      const seed = [...postId].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 3);
      const values: Record<string, number> = {};
      metrics.forEach((m, i) => {
        values[m] = 10 + ((seed + i * 53) % 200);
      });
      return { values, problem: null };
    },

    async publish(page) {
      const known = MOCK_PAGES.find((p) => p.id === page.id);
      if (!known?.canPublish) throw new SocialError("permission_missing", describeSocialError("permission_missing"));
      return { providerPostId: `${page.id}_mock${Date.now()}` };
    },
  };
}
