import { SocialError, describeSocialError, type PageGrant, type SocialPublishingProvider } from "./provider";

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
        scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
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

    async publish(page) {
      const known = MOCK_PAGES.find((p) => p.id === page.id);
      if (!known?.canPublish) throw new SocialError("permission_missing", describeSocialError("permission_missing"));
      return { providerPostId: `${page.id}_mock${Date.now()}` };
    },
  };
}
