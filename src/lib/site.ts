export const siteConfig = {
  name: "LazyAI",
  tagline: "Work less. Publish more.",
  description:
    "Give LazyAI a topic or website. Get a content plan, review the posts in English or Bengali, and publish them to your Facebook Page on schedule.",
  nav: [
    { label: "How it works", href: "/#how" },
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "/#faq" },
  ],
  footer: [
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;

/** Sections of the signed-in app. Pages for these arrive in later batches. */
export const appSections = {
  projects: {
    title: "Projects",
    description: "Start from a topic, an article link, or a whole website.",
  },
  campaigns: {
    title: "Campaigns",
    description: "Plan 30, 60, or 90 posts and watch them generate in small, safe batches.",
  },
  content: {
    title: "Content",
    description: "Review, edit, approve, or regenerate every post before it is scheduled.",
  },
  calendar: {
    title: "Calendar",
    description: "See what goes out and when, in your own timezone.",
  },
  pages: {
    title: "Facebook Pages",
    description: "Connect a Page and choose exactly which one LazyAI may manage.",
  },
  media: {
    title: "Media",
    description: "Upload images and attach them to posts.",
  },
  activity: {
    title: "Activity",
    description: "A clear history of what was generated, scheduled, and published.",
  },
} as const;

export type AppSectionKey = keyof typeof appSections;
