/** Free tool: Facebook post idea generator. Pure and deterministic (no AI, no network): the same choices give the same ideas. */

export type Goal = "awareness" | "engagement" | "sales" | "trust";

export const GOALS: { value: Goal; label: string }[] = [
  { value: "awareness", label: "Get noticed by new people" },
  { value: "engagement", label: "Get comments and shares" },
  { value: "sales", label: "Sell more" },
  { value: "trust", label: "Build trust" },
];

type Vocab = { label: string; products: [string, string, string]; audience: string; customer: string; place: string };

export const BUSINESS_TYPES = {
  restaurant: { label: "Restaurant or cafe", products: ["signature dish", "weekend special", "homemade dessert"], audience: "hungry regulars", customer: "a regular who comes in every week", place: "our kitchen" },
  clothing: { label: "Clothing or fashion shop", products: ["new arrival", "best-selling outfit", "seasonal collection"], audience: "style-conscious shoppers", customer: "a customer who found the perfect fit", place: "our store" },
  salon: { label: "Salon, spa, or beauty", products: ["signature treatment", "hair color service", "skincare routine"], audience: "clients who want to feel their best", customer: "a client who tried something new", place: "our studio" },
  fitness: { label: "Gym or fitness coach", products: ["beginner class", "12-week program", "personal training session"], audience: "people starting their fitness journey", customer: "a member who reached a goal", place: "our gym" },
  realestate: { label: "Real estate", products: ["new listing", "first-time buyer guide", "open house"], audience: "buyers and renters", customer: "a family who just got their keys", place: "the neighborhood" },
  education: { label: "Coaching or education", products: ["online course", "free workshop", "one-on-one session"], audience: "learners who want clear results", customer: "a student who finally got it", place: "our classroom" },
  ecommerce: { label: "Online shop", products: ["best seller", "limited stock item", "gift bundle"], audience: "online shoppers", customer: "a customer who left a great review", place: "our packing table" },
  agency: { label: "Agency or freelancer", products: ["website project", "brand design package", "monthly service"], audience: "business owners who need a reliable partner", customer: "a client we helped grow", place: "our workspace" },
  clinic: { label: "Clinic or health practice", products: ["check-up service", "wellness program", "new treatment"], audience: "patients and their families", customer: "a patient who now feels better", place: "our clinic" },
  travel: { label: "Travel or tours", products: ["weekend trip", "guided tour", "holiday package"], audience: "travelers planning their next trip", customer: "a traveler who had a great trip", place: "the road" },
  handmade: { label: "Handmade or crafts", products: ["handmade piece", "custom order", "new design"], audience: "people who love one-of-a-kind things", customer: "a buyer who ordered a custom piece", place: "our workshop" },
  localservice: { label: "Local service (repair, cleaning, etc.)", products: ["most requested service", "seasonal checkup", "package deal"], audience: "neighbors who need dependable help", customer: "a neighbor we helped this week", place: "our van" },
} satisfies Record<string, Vocab>;

export type BusinessType = keyof typeof BUSINESS_TYPES;

type IdeaKind = "behind" | "story" | "tip" | "question" | "offer" | "myth" | "howto" | "faq" | "results" | "owner" | "timely" | "spotlight" | "mistake";

const TEMPLATES: Record<IdeaKind, { title: string; ideas: [string, string, string]; openers: [string, string, string] }> = {
  behind: { title: "Behind the scenes", ideas: ["Show a short moment from {place} while you prepare the {product}. Say what goes into it that customers never see.", "Post a photo of your workspace at the start of the day and describe the first thing you do before opening for {audience}.", "Share how the {product} is made, step by step, in three short sentences and one clear photo."], openers: ["Here is what really happens before we open.", "Ever wondered how this is made?", "A quick look at {place} today."] },
  story: { title: "Customer story", ideas: ["Tell the story of {customer}: what they needed, what you did, and how it went. Ask permission first and keep it specific.", "Share a kind message from {customer} (with permission) and thank them by name.", "Write a short before-and-after story about how your {product} helped one real person."], openers: ["This made our week.", "Meet {customer}.", "A thank-you we want to share."] },
  tip: { title: "Quick tip", ideas: ["Give {audience} one practical tip about the {product} they can use today, in three short lines.", "Share a small mistake you see often and the simple fix.", "Post a 'one thing I wish everyone knew' tip from your own experience."], openers: ["One quick tip for you today.", "Save this for later.", "Here is something we wish we knew sooner."] },
  question: { title: "Question or poll", ideas: ["Ask {audience} a simple either-or question about the {product} (for example, A or B?) and promise to share the results.", "Ask what they would like to see more of from you, and reply to every comment.", "Post two photos and ask which one they prefer."], openers: ["Quick question for you:", "Help us decide!", "This or that?"] },
  offer: { title: "Offer or announcement", ideas: ["Announce a clear offer on the {product}: what it is, who it is for, the price or saving, and the last day to get it.", "Share one reason someone should choose the {product} this week, and exactly how to order or book.", "Tell people about a small bonus for the first few customers, with a simple way to claim it."], openers: ["New this week:", "Only until the end of the week.", "Here is how to get it:"] },
  myth: { title: "Myth versus fact", ideas: ["Name one common myth about your {product} and explain the truth in plain words.", "Share something people often get wrong when choosing a provider like you, and how to tell good from bad.", "Pick a belief your customers repeat and gently correct it with an example."], openers: ["Myth: …  Fact: …", "Let's clear something up.", "You may have heard this before."] },
  howto: { title: "How-to", ideas: ["Write a short numbered how-to (three to five steps) that helps {audience} get more from the {product}.", "Make a simple checklist that {audience} can follow this week.", "Explain how to choose between two options of your {product} in a few lines."], openers: ["Three steps to get it right:", "A simple checklist for you.", "Here is how to do it."] },
  faq: { title: "Frequently asked question", ideas: ["Answer the question you hear most about the {product}. Start with the answer, then explain.", "Pick a question from a recent message, answer it publicly, and invite others to ask more.", "Answer a question about price, timing, or delivery that holds people back from buying."], openers: ["You asked, we answer.", "The question we hear every week:", "Short answer first:"] },
  results: { title: "Results or before and after", ideas: ["Show a real before-and-after of the {product} and say what changed and how long it took.", "Share one number or result from this month that you are proud of, and what it means for {audience}.", "Post a progress update on a project you are working on."], openers: ["Before and after.", "Look what changed.", "Progress update:"] },
  owner: { title: "Meet the owner or team", ideas: ["Introduce yourself or a team member: name, role, one fun fact, and what they love about the work.", "Tell why you started this business in four honest sentences.", "Share a lesson you learned the hard way while running {place}."], openers: ["Meet the person behind this.", "Why we started.", "Something we learned the hard way."] },
  timely: { title: "Timely or seasonal", ideas: ["Link the {product} to a season, holiday, or event coming up, and say what {audience} should do before it arrives.", "Share your opening hours or plans for the next holiday and a reminder to order early.", "Post about something happening in the neighborhood and how you are part of it."], openers: ["Coming up soon:", "Plan ahead with us.", "Heads up for this week."] },
  spotlight: { title: "Product spotlight", ideas: ["Feature one {product} with a clear photo, three benefits, and one sentence about who it is best for.", "Compare two versions of the {product} and say who should pick which.", "Show the {product} in real use, not only on a plain background."], openers: ["Spotlight on our {product}.", "Have you tried this yet?", "Who is this perfect for?"] },
  mistake: { title: "Mistake to avoid", ideas: ["List three mistakes {audience} make with the {product} and how to avoid each one.", "Share the single biggest mistake you see and what to do instead.", "Tell a short story of a mistake someone made, kindly, and the lesson in it."], openers: ["Please avoid this mistake.", "Three mistakes we see all the time.", "Learn from this one."] },
};

const ORDER: Record<Goal, IdeaKind[]> = {
  awareness: ["behind", "tip", "howto", "owner", "timely", "myth", "spotlight", "question", "faq", "story", "results", "offer", "mistake"],
  engagement: ["question", "myth", "behind", "story", "owner", "tip", "timely", "mistake", "spotlight", "howto", "faq", "results", "offer"],
  sales: ["offer", "spotlight", "results", "story", "faq", "howto", "timely", "tip", "mistake", "myth", "behind", "owner", "question"],
  trust: ["story", "results", "faq", "behind", "owner", "myth", "howto", "tip", "mistake", "spotlight", "timely", "question", "offer"],
};

export type Idea = { kind: string; title: string; idea: string; opener: string };

const fill = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");

/** Twelve ideas for the chosen business and goal. A higher `round` gives a fresh set (different wording and some different post types). */
export function generateIdeas(input: { business: BusinessType; goal: Goal; name?: string; product?: string; round?: number }): Idea[] {
  const vocab: Vocab = BUSINESS_TYPES[input.business];
  const round = Math.max(0, Math.floor(input.round ?? 0));
  const order = ORDER[input.goal];
  const start = (round * 3) % order.length;
  const kinds = Array.from({ length: 12 }, (_, i) => order[(start + i) % order.length] as IdeaKind);
  const product = (input.product ?? "").trim().slice(0, 60);
  return kinds.map((kind, i) => {
    const t = TEMPLATES[kind];
    const variant = (round + i) % 3;
    const vars = {
      product: product || vocab.products[(round + i) % 3],
      audience: vocab.audience,
      customer: vocab.customer,
      place: vocab.place,
      business: (input.name ?? "").trim().slice(0, 60) || "our business",
    };
    return { kind, title: t.title, idea: fill(t.ideas[variant], vars), opener: fill(t.openers[variant], vars) };
  });
}
