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
    { label: "About", href: "/about" },
    { label: "Help", href: "/help" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Acceptable use", href: "/acceptable-use" },
    { label: "Cookies", href: "/cookies" },
    { label: "Data deletion", href: "/data-deletion" },
  ],
} as const;

/** Sections of the signed-in app. Pages for these arrive in later batches. */
export const appSections = {
  pages: {
    title: "Facebook Pages",
    description: "Connect a Page and choose exactly which one LazyAI may manage.",
  },
  media: {
    title: "Media",
    description: "Upload images and attach them to posts.",
  },
} as const;

export type AppSectionKey = keyof typeof appSections;
