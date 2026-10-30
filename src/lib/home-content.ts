import { BENGALI } from "./site-pages";

/** The words on the home page. An admin edits them in Admin -> Pages -> Home page; the built-in values are the fallback. */
export type Pair = { title: string; body: string };
export type Faq = { q: string; a: string };

export type HomeContent = {
  hero: { badge: string; titleLead: string; titleAccent: string; subtitle: string; primaryCta: string; secondaryCta: string; reassurances: string[] };
  how: { title: string; steps: Pair[] };
  features: { title: string; items: Pair[] };
  faq: { title: string; items: Faq[] };
  cta: { title: string; subtitle: string; button: string };
};

export const DEFAULT_HOME: HomeContent = {
  hero: {
    badge: "Facebook Pages · English & Bengali",
    titleLead: "Work less.",
    titleAccent: "Publish more.",
    subtitle: "Give LazyAI a topic or a website. Get a content plan, edit the posts, and publish them on schedule — in English or Bengali.",
    primaryCta: "Start free",
    secondaryCta: "See how it works",
    reassurances: ["Nothing is posted unless you schedule it", "You choose which Page LazyAI can use", "“Published” only appears after Facebook confirms it"],
  },
  how: {
    title: "From idea to scheduled in three steps",
    steps: [
      { title: "Give it a topic or website", body: "Type a keyword, paste an article link, or point to your site. Pick English, Bengali, or both." },
      { title: "Check the plan and posts", body: "See a proposed calendar first. Edit or regenerate any post, and cancel it any time before it goes out." },
      { title: "Schedule and relax", body: "Scheduled posts are queued for your Facebook Page. If something fails, you see why and can retry." },
    ],
  },
  features: {
    title: "Everything you need to keep your Page active",
    items: [
      { title: "Topic, article, or website", body: "Start from a keyword, a single link, or a whole site. LazyAI writes original posts, not copies." },
      { title: "Campaigns of 30, 60, or 90 posts", body: "Plan a full month at once. Posts are generated in small batches, so nothing is lost if one fails." },
      { title: "Written for Bengali, not translated", body: "Natural Bengali and English posts that match your audience and brand voice." },
      { title: "You stay in control", body: "Edit or regenerate any post, and cancel it any time before it goes out." },
      { title: "A calendar that makes sense", body: "See every post by day and status, in your own timezone (Asia/Dhaka by default)." },
      { title: "Honest statuses and safe retries", body: "Ready, scheduled, published, failed — always accurate. Retries never create duplicate posts." },
    ],
  },
  faq: {
    title: "Questions, answered",
    items: [
      { q: "Will LazyAI post without my permission?", a: "No. LazyAI only posts what you schedule, on the Pages you connected, at the time you chose. You can edit or cancel any post before it goes out." },
      { q: "Which platforms are supported?", a: "Facebook Pages come first. Personal Facebook profiles are not supported. More platforms may follow later." },
      { q: "Which languages can it write in?", a: "English and Bengali at launch, either one or both in the same campaign." },
      { q: "How do I know a post was really published?", a: "LazyAI marks a post as published only after Facebook confirms it. Until then it is shown as scheduled, retrying, or failed." },
      { q: "How much does it cost?", a: "You can start free. See the Pricing page for the plans, and upgrade only when you need more." },
    ],
  },
  cta: { title: "Ready to publish more with less effort?", subtitle: "Create your first campaign and schedule it in minutes.", button: "Start free" },
};

const MAX = { short: 160, long: 600, list: 12 };
const text = (v: unknown, fallback: string, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);

function pairs(v: unknown, fallback: Pair[]): Pair[] {
  if (!Array.isArray(v)) return fallback;
  const out = v
    .map((p) => (p && typeof p === "object" ? { title: text((p as Pair).title, "", MAX.short), body: text((p as Pair).body, "", MAX.long) } : null))
    .filter((p): p is Pair => p !== null && p.title !== "" && p.body !== "")
    .slice(0, MAX.list);
  return out.length > 0 ? out : fallback;
}

/** Turns whatever was saved into valid home content. Missing or broken parts fall back to the built-in text. */
export function normalizeHome(raw: unknown): HomeContent {
  const d = DEFAULT_HOME;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof HomeContent, Record<string, unknown>>>;
  const hero = r.hero ?? {};
  const how = r.how ?? {};
  const features = r.features ?? {};
  const faq = r.faq ?? {};
  const cta = r.cta ?? {};
  const reassurances = Array.isArray(hero.reassurances) ? (hero.reassurances as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, MAX.short)).slice(0, 6) : [];
  const faqItems = Array.isArray(faq.items)
    ? (faq.items as Faq[])
        .map((i) => (i && typeof i === "object" ? { q: text(i.q, "", MAX.short), a: text(i.a, "", MAX.long) } : null))
        .filter((i): i is Faq => i !== null && i.q !== "" && i.a !== "")
        .slice(0, MAX.list)
    : [];
  return {
    hero: {
      badge: text(hero.badge, d.hero.badge, MAX.short),
      titleLead: text(hero.titleLead, d.hero.titleLead, MAX.short),
      titleAccent: text(hero.titleAccent, d.hero.titleAccent, MAX.short),
      subtitle: text(hero.subtitle, d.hero.subtitle, MAX.long),
      primaryCta: text(hero.primaryCta, d.hero.primaryCta, 40),
      secondaryCta: text(hero.secondaryCta, d.hero.secondaryCta, 40),
      reassurances: reassurances.length > 0 ? reassurances : d.hero.reassurances,
    },
    how: { title: text(how.title, d.how.title, MAX.short), steps: pairs(how.steps, d.how.steps) },
    features: { title: text(features.title, d.features.title, MAX.short), items: pairs(features.items, d.features.items) },
    faq: { title: text(faq.title, d.faq.title, MAX.short), items: faqItems.length > 0 ? faqItems : d.faq.items },
    cta: { title: text(cta.title, d.cta.title, MAX.short), subtitle: text(cta.subtitle, d.cta.subtitle, MAX.long), button: text(cta.button, d.cta.button, 40) },
  };
}

/** "Title | Body" per line, for the editor's text boxes. */
export function parsePairLines(raw: string): Pair[] {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("|");
      return i < 0 ? null : { title: line.slice(0, i).trim(), body: line.slice(i + 1).trim() };
    })
    .filter((p): p is Pair => p !== null && p.title !== "" && p.body !== "");
}

export const formatPairLines = (items: Pair[]) => items.map((p) => `${p.title} | ${p.body}`).join("\n");
export const parseLines = (raw: string) => raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Error message, or null when the home content may be saved (English only, within the size limits). */
export function validateHome(content: HomeContent): string | null {
  if (BENGALI.test(JSON.stringify(content))) return "The site text must be in English. Remove the Bengali characters.";
  if (content.how.steps.length < 1 || content.features.items.length < 1 || content.faq.items.length < 1) return "Each section needs at least one entry.";
  return null;
}
