/** Meta App Review helpers (pure: no database, no network). Nothing here submits anything to Meta; it only checks and drafts. */

export const META_PERMISSIONS = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] as const;
export type MetaPermission = (typeof META_PERMISSIONS)[number];

/** Draft answers for the "how will you use this permission" boxes. They must match what the app really does. */
export const PERMISSION_ANSWERS: Record<MetaPermission, string> = {
  pages_show_list:
    "After a person signs in with Facebook, LazyAI shows the list of Pages they manage so they can choose which Pages to connect. We show only the Page names, and only to the signed-in person.",
  pages_read_engagement:
    "LazyAI reads basic information about each Page the person chose to connect (its name, category, and the person's role) and confirms that the connection still works. We do not show or store engagement analytics.",
  pages_manage_posts:
    "LazyAI publishes to a connected Page the posts that the person wrote and approved in LazyAI, at the date and time they scheduled. Nothing is published without the person's approval, and they can cancel a scheduled post, or disconnect the Page, at any time.",
};

export type ReviewStep = { time: string; show: string; say: string };

/** A two-minute screencast outline. */
export const SCREENCAST_STEPS: ReviewStep[] = [
  { time: "0:00", show: "The LazyAI sign-in page, then the dashboard after signing in with the reviewer account.", say: "This is LazyAI, a tool that helps people write and schedule posts for their Facebook Pages." },
  { time: "0:15", show: "Facebook Pages -> Connect Facebook.", say: "The person starts the connection themselves." },
  { time: "0:25", show: "The Facebook permission dialog, slowly, with the three permissions visible.", say: "Facebook asks the person to approve the permissions. pages_show_list lets us list their Pages." },
  { time: "0:45", show: "Choosing one Page in the list, then the connected Page in LazyAI.", say: "The person picks which Page to connect. pages_read_engagement lets us read the Page's basic details and check the connection." },
  { time: "1:00", show: "Opening a post, pressing Approve, and scheduling it a few minutes ahead.", say: "The person writes or edits the post and approves it. Nothing is published without approval." },
  { time: "1:20", show: "The scheduled post at its time, then the same post on the real Facebook Page.", say: "pages_manage_posts lets LazyAI publish the approved post at the scheduled time." },
  { time: "1:40", show: "Disconnect on the Facebook Pages screen.", say: "The person can disconnect the Page at any time." },
  { time: "1:50", show: "The Data deletion page.", say: "People can ask us to delete their data, and Facebook's own deletion request is supported." },
];

export function reviewerInstructions(appUrl: string): string {
  return [
    `Open ${appUrl}/auth/login and sign in with the reviewer account below.`,
    "Email: [put the reviewer email here]",
    "Password: [put the reviewer password here]",
    "",
    "1. Go to Facebook Pages in the left menu and press Connect Facebook.",
    "2. Approve the Facebook permissions and choose one of your Pages.",
    "3. Open Create, write a short post (or use a draft), press Approve, and choose Schedule. Pick a time a few minutes from now.",
    "4. When the time arrives the post appears on your Page. It can take up to a minute after the scheduled time.",
    "5. To remove the connection, press Disconnect on the Facebook Pages screen. Data deletion instructions are at " + appUrl + "/data-deletion.",
    "",
    "Live publishing is switched on for this review. The reviewer account has its own workspace, so nothing you do affects other customers.",
  ].join("\n");
}

export type PageProbe = { path: string; label: string };
export const PUBLIC_PAGE_PROBES: PageProbe[] = [
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Service" },
  { path: "/contact", label: "Contact" },
  { path: "/data-deletion", label: "Data deletion instructions" },
];

export type ProbeOutcome = { path: string; label: string; state: "ok" | "todo" | "unknown"; detail: string };

/** Judges one fetched page. `status` is null when the page could not be fetched at all. */
export function judgePage(probe: PageProbe, status: number | null, body: string, contactEmail: string | null): ProbeOutcome {
  if (status === null) return { ...probe, state: "unknown", detail: "Could not be fetched from here. Open it yourself in a private window." };
  if (status !== 200) return { ...probe, state: "todo", detail: `Answered with status ${status}. Meta's reviewer must be able to open it without signing in.` };
  if (body.length < 500) return { ...probe, state: "todo", detail: "The page is almost empty." };
  if (probe.path === "/contact" && contactEmail && !body.includes(contactEmail)) return { ...probe, state: "todo", detail: "Your support email is not shown on the page." };
  if ((probe.path === "/privacy" || probe.path === "/terms") && /\[(your|add|insert)[^\]]*\]/i.test(body)) return { ...probe, state: "todo", detail: "The page still has a placeholder in square brackets." };
  return { ...probe, state: "ok", detail: "Opens without signing in." };
}

export type MetaFacts = {
  appIdSet: boolean;
  appSecretSet: boolean;
  tokenKeySet: boolean;
  redirectUriMatches: boolean;
  contactEmailSet: boolean;
  operatorNameSet: boolean;
  operatorCountrySet: boolean;
  mock: boolean;
  liveFlagOn: boolean;
  cronReady: boolean;
  isHttps: boolean;
};

export type MetaCheck = { id: string; label: string; state: "ok" | "todo" | "warn"; detail: string };

export function metaChecks(f: MetaFacts): MetaCheck[] {
  const yes = (ok: boolean, good: string, bad: string, id: string, label: string, state: "todo" | "warn" = "todo"): MetaCheck => ({ id, label, state: ok ? "ok" : state, detail: ok ? good : bad });
  return [
    yes(f.isHttps, "The site uses https.", "Meta needs an https address.", "https", "Secure address"),
    yes(f.appIdSet && f.appSecretSet, "The Meta app id and secret are set.", "META_APP_ID or META_APP_SECRET is missing in your hosting settings.", "app", "Meta app settings"),
    yes(f.tokenKeySet, "The token encryption key is set.", "The token encryption key is missing, so Page connections cannot be stored safely.", "token", "Token encryption key"),
    yes(f.redirectUriMatches, "The redirect address matches your site.", "META_REDIRECT_URI points somewhere other than this site's /api/meta/callback.", "redirect", "OAuth redirect address"),
    yes(!f.mock, "Test mode (pretend Facebook) is off.", "Test mode is on. Reviewers need real posting.", "mock", "Real Facebook mode"),
    yes(f.contactEmailSet, "A support email is set.", "NEXT_PUBLIC_CONTACT_EMAIL is missing.", "email", "Support email"),
    yes(f.operatorNameSet && f.operatorCountrySet, "Business name and country are set.", "NEXT_PUBLIC_OPERATOR_NAME or NEXT_PUBLIC_OPERATOR_COUNTRY is missing.", "operator", "Business name and country"),
    yes(f.liveFlagOn, "Live publishing is on.", "Live publishing is off. Turn it on in Admin -> Publishing before reviewers test (they need real posting).", "live", "Live publishing", "warn"),
    yes(f.cronReady, "The scheduler secret is set.", "CRON_SECRET is missing, so scheduled posts will not go out.", "cron", "Scheduler"),
  ];
}

export const REJECTION_RISKS: string[] = [
  "The screencast does not show each permission being used. Show the Facebook dialog and the result on screen for all three.",
  "The reviewer cannot log in. Test the reviewer account in a private window just before you submit.",
  "The Privacy Policy does not mention the Facebook data you use, or the deletion route. Read both pages once more.",
  "A permission is requested but never used in the video. Request only what the app really uses.",
  "Live publishing was off or the scheduler was down while the reviewer tested. Check Admin -> Launch right before you submit.",
  "The app is still in Development mode with the wrong roles. Add reviewers as testers if Meta asks, and switch to Live after approval.",
  "The business is not verified. Start business verification early: it can take days or weeks.",
];
