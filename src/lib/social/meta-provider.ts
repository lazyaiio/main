import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  SocialError,
  describeSocialError,
  type PageGrant,
  type PublishInput,
  type PublishResult,
  type SocialErrorKind,
  type SocialPublishingProvider,
  type TokenInfo,
} from "./provider";

/**
 * Meta (Facebook Pages) adapter. Official Graph API only.
 *
 * Rules built in:
 *  - tokens are never logged or put in error messages; errors carry only numeric codes,
 *  - every call that uses a user or Page token also sends appsecret_proof (works with the
 *    "Require App Secret" setting),
 *  - paging links are followed only when they point at graph.facebook.com.
 */

export const META_REQUIRED_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] as const;
export const DEFAULT_GRAPH_VERSION = "v25.0";
const GRAPH_HOST = "graph.facebook.com";
const MAX_PAGE_REQUESTS = 4;

export type MetaConfig = {
  appId: string;
  appSecret: string;
  /** For example "v25.0". */
  apiVersion: string;
  /** Facebook Login for Business configuration id. When empty, classic permissions (scope) are requested. */
  loginConfigId?: string | null;
};

/** The proof Meta recommends for server calls: HMAC-SHA256 of the token with the app secret. */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

const graphError = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.number().optional(),
      error_subcode: z.number().optional(),
      fbtrace_id: z.string().optional(),
    })
    .passthrough(),
});

/** Turns a Graph API error answer into one of our own error kinds. */
export function classifyGraphError(status: number, body: unknown): SocialError {
  const parsed = graphError.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : undefined;
  const subcode = parsed.success ? parsed.data.error.error_subcode : undefined;
  const trace = parsed.success ? parsed.data.error.fbtrace_id : undefined;
  const details = { status, code, subcode, trace, uncertain: status >= 500 || code === 1 || code === 2 };

  let kind: SocialErrorKind = "unknown";
  if (code === 190) kind = "token_expired";
  else if (code === 10 || code === 3 || (code !== undefined && code >= 200 && code <= 299)) kind = "permission_missing";
  else if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== undefined && code >= 80000 && code <= 80014)) kind = "rate_limited";
  else if (code === 368 || code === 506 || code === 1609005) kind = "content_rejected";
  else if (code === 100 && subcode === 33) kind = "page_access_lost";
  else if (code === 100) kind = "invalid_request";
  else if (code === 1 || code === 2 || status >= 500) kind = "temporary";
  else if (status === 401) kind = "token_expired";
  else if (status === 403) kind = "permission_missing";
  else if (status === 429) kind = "rate_limited";

  return new SocialError(kind, describeSocialError(kind), details);
}

const tokenAnswer = z.object({ access_token: z.string().min(10) });
const debugAnswer = z.object({
  data: z.object({
    is_valid: z.boolean(),
    user_id: z.union([z.string(), z.number()]).optional(),
    scopes: z.array(z.string()).optional(),
    expires_at: z.number().optional(),
    data_access_expires_at: z.number().optional(),
  }),
});
const meAnswer = z.object({ id: z.string(), name: z.string().optional() });
const accountsAnswer = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string().nullish(),
      tasks: z.array(z.string()).optional(),
      access_token: z.string().optional(),
    }),
  ),
  paging: z.object({ next: z.string().optional() }).optional(),
});
const pageAnswer = z.object({ id: z.string(), name: z.string().optional() });
const postAnswer = z.object({ id: z.string().optional(), post_id: z.string().optional() });

const secondsToDate = (seconds: number | undefined): Date | null => (seconds && seconds > 0 ? new Date(seconds * 1000) : null);

export function createMetaProvider(config: MetaConfig, fetchFn: typeof fetch = fetch): SocialPublishingProvider {
  const base = `https://${GRAPH_HOST}/${config.apiVersion}`;

  async function request(url: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(15_000), redirect: "error" });
    } catch {
      // The request may or may not have reached Facebook.
      throw new SocialError("temporary", describeSocialError("temporary"), { uncertain: true });
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) throw classifyGraphError(response.status, body);
    return body;
  }

  /** GET with a user or Page token. */
  function get(path: string, token: string, params: Record<string, string> = {}): Promise<unknown> {
    const query = new URLSearchParams({ ...params, access_token: token, appsecret_proof: appSecretProof(token, config.appSecret) });
    return request(`${base}${path}?${query.toString()}`);
  }

  function post(path: string, token: string, body: URLSearchParams | FormData): Promise<unknown> {
    body.set("access_token", token);
    body.set("appsecret_proof", appSecretProof(token, config.appSecret));
    return request(`${base}${path}`, { method: "POST", body });
  }

  async function tokenCall(params: Record<string, string>): Promise<{ accessToken: string }> {
    const query = new URLSearchParams({ ...params, client_id: config.appId, client_secret: config.appSecret });
    const parsed = tokenAnswer.safeParse(await request(`${base}/oauth/access_token?${query.toString()}`));
    if (!parsed.success) throw new SocialError("unknown", describeSocialError("unknown"));
    return { accessToken: parsed.data.access_token };
  }

  return {
    id: "meta",
    requiredScopes: META_REQUIRED_SCOPES,

    buildAuthorizationUrl({ state, redirectUri }) {
      const params = new URLSearchParams({ client_id: config.appId, redirect_uri: redirectUri, state, response_type: "code" });
      if (config.loginConfigId) {
        // Facebook Login for Business: the configuration decides the permissions.
        params.set("config_id", config.loginConfigId);
        params.set("override_default_response_type", "true");
      } else {
        params.set("scope", META_REQUIRED_SCOPES.join(","));
      }
      return `https://www.facebook.com/${config.apiVersion}/dialog/oauth?${params.toString()}`;
    },

    exchangeCode({ code, redirectUri }) {
      return tokenCall({ code, redirect_uri: redirectUri });
    },

    extendUserToken(token) {
      return tokenCall({ grant_type: "fb_exchange_token", fb_exchange_token: token });
    },

    async inspectToken(token): Promise<TokenInfo> {
      const query = new URLSearchParams({ input_token: token, access_token: `${config.appId}|${config.appSecret}` });
      const parsed = debugAnswer.safeParse(await request(`${base}/debug_token?${query.toString()}`));
      if (!parsed.success) throw new SocialError("unknown", describeSocialError("unknown"));
      const data = parsed.data.data;
      return {
        valid: data.is_valid,
        userId: data.user_id !== undefined ? String(data.user_id) : null,
        scopes: data.scopes ?? [],
        expiresAt: secondsToDate(data.expires_at),
        dataAccessExpiresAt: secondsToDate(data.data_access_expires_at),
      };
    },

    async listPages(userToken) {
      const me = meAnswer.safeParse(await get("/me", userToken, { fields: "id,name" }));
      if (!me.success) throw new SocialError("unknown", describeSocialError("unknown"));

      const pages: PageGrant[] = [];
      let next: string | null = `${base}/me/accounts?${new URLSearchParams({
        fields: "id,name,category,tasks,access_token",
        limit: "100",
        access_token: userToken,
        appsecret_proof: appSecretProof(userToken, config.appSecret),
      }).toString()}`;

      for (let i = 0; next && i < MAX_PAGE_REQUESTS; i++) {
        const parsed = accountsAnswer.safeParse(await request(next));
        if (!parsed.success) throw new SocialError("unknown", describeSocialError("unknown"));
        for (const item of parsed.data.data) {
          if (!item.access_token) continue; // no Page token means the person cannot act on this Page
          const tasks = item.tasks ?? [];
          pages.push({
            id: item.id,
            name: item.name.slice(0, 200),
            category: item.category ?? null,
            tasks,
            accessToken: item.access_token,
            canPublish: tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE"),
          });
        }
        const link = parsed.data.paging?.next;
        next = null;
        if (link) {
          try {
            // Only follow paging links that stay on Meta's own host (they contain the token).
            if (new URL(link).hostname === GRAPH_HOST && new URL(link).protocol === "https:") next = link;
          } catch {
            next = null;
          }
        }
      }
      return { user: { id: me.data.id, name: me.data.name ?? "Facebook user" }, pages };
    },

    async checkPage(page) {
      if (!/^\d{1,25}$/.test(page.id)) throw new SocialError("invalid_request", describeSocialError("invalid_request"));
      const parsed = pageAnswer.safeParse(await get(`/${page.id}`, page.accessToken, { fields: "id,name" }));
      if (!parsed.success) throw new SocialError("unknown", describeSocialError("unknown"));
      return { name: parsed.data.name ?? "Page" };
    },

    async publish(page, input: PublishInput): Promise<PublishResult> {
      if (!/^\d{1,25}$/.test(page.id)) throw new SocialError("invalid_request", describeSocialError("invalid_request"));
      if (input.image) {
        // Photo post: the image file is sent with the request, the text becomes the caption.
        const form = new FormData();
        form.set("caption", input.message);
        form.set("published", "true");
        form.set("source", new Blob([input.image.bytes as BlobPart], { type: input.image.mime }), "image");
        const parsed = postAnswer.safeParse(await post(`/${page.id}/photos`, page.accessToken, form));
        const id = parsed.success ? (parsed.data.post_id ?? parsed.data.id) : undefined;
        // An answer without a post id after a successful call: the post may exist.
        if (!id) throw new SocialError("unknown", describeSocialError("unknown"), { uncertain: true });
        return { providerPostId: id };
      }
      // Text or link post.
      const body = new URLSearchParams({ message: input.message });
      if (input.link) body.set("link", input.link);
      const parsed = postAnswer.safeParse(await post(`/${page.id}/feed`, page.accessToken, body));
      if (!parsed.success || !parsed.data.id) throw new SocialError("unknown", describeSocialError("unknown"), { uncertain: true });
      return { providerPostId: parsed.data.id };
    },
  };
}
