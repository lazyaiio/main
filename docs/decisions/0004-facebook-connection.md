# ADR 0004: How Facebook Pages are connected and tokens are kept

Status: accepted (Batch 8)

## Context
LazyAI must connect customers' Facebook Pages with the official Meta Graph API and later publish to them. Page access tokens are powerful secrets. Meta's current Pages use case signs in through Facebook Login for Business (configuration id) while older apps use classic permissions.

## Decision
- **Provider interface** (`SocialPublishingProvider`) with a Meta adapter and a mock. The adapter covers login URL, code exchange, long-lived token, token inspection, Page listing, Page check, and publishing (text, link, photo). Publishing is implemented and tested against a fake network but connected to no screen: live posting needs a separate approval and arrives with Batch 9.
- **Login:** a server action starts the attempt (so a link cannot start one), creates a one-time record (10 minutes, only a hash of the secret `state` is stored), and sets an HttpOnly cookie. The callback accepts the return only if the URL state, the cookie, the stored hash, the signed-in user, and the workspace all match. If `META_LOGIN_CONFIG_ID` is set, the login uses the Facebook Login for Business configuration; otherwise it asks for permissions directly.
- **Permissions:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. When Facebook reports the granted permissions, all three must be present.
- **Two steps:** after Facebook approves, the Pages (with their tokens) are kept encrypted in the attempt record while the admin chooses which to connect. Only chosen Pages keep a token; everything else is erased. Only Pages where the person can create posts can be chosen.
- **Token storage:** tokens are encrypted by the app with AES-256-GCM (key derived from `TOKEN_ENCRYPTION_KEY`, random IV, bound to workspace and Page) and stored in `social_page_tokens`. That table and `social_oauth_flows` have no browser access; only server code with the service-role key reads them. `social_accounts` and `social_pages` hold no secrets and are read-only for browsers. Tokens never appear in logs, errors, or pages; every Graph call also sends `appsecret_proof`.
- **One workspace per Page:** `provider_page_id` is unique across LazyAI, so a Page cannot be connected twice.
- **Only owners and admins** connect, check, or disconnect Pages.
- **Errors** are mapped to plain-English, actionable messages (expired token, missing permission, lost Page role, rate limit, temporary problem). Raw Facebook messages are never shown; only numeric codes are kept for support.
- **Disconnect** deletes the stored token and marks the Page disconnected. Removing the app from Facebook is done by the person in Facebook's settings.

## Consequences
- Needs `SUPABASE_SERVICE_ROLE_KEY` and `TOKEN_ENCRYPTION_KEY` in Vercel. Losing the encryption key means reconnecting Pages.
- Page tokens from a long-lived user token do not expire, but can be revoked; "Check connection" and the Batch 9 publisher detect that.
- Customer-facing launch needs Meta App Review and business verification (see `docs/META_SETUP.md`).
