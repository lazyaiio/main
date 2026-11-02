import type { Metadata } from "next";
import { PostIdeaTool } from "@/components/tools/post-idea-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/post-idea-generator");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/post-idea-generator"
      name="Facebook Post Idea Generator"
      headline="Facebook post idea generator"
      intro="Choose your kind of business and what you want your posts to do. Get twelve ready-to-use post ideas, each with an opening line, and ask for a fresh set whenever you run out."
      category="content-planning"
      steps={["Pick the kind of business that is closest to yours.", "Choose your goal: new people, comments, sales, or trust.", "Type your business name and what you sell, if you like. The ideas will use your own words.", "Copy the ideas you like, then write each post in your own voice with a real photo."]}
      tips={["Mix the types of posts. A week of only offers wears readers out, and a week of only tips never asks for the sale.", "Use real details: a name, a place, a price, a date. Specific posts are more believable than general ones.", "Pair every idea with one clear next step, such as a question to answer or a button to press.", "If a post idea does not fit your business, press the button for a new set instead of forcing it."]}
      faq={[
        { q: "Does this tool use AI?", a: "No. The ideas come from a library of tested post patterns that are filled in with your business type and goal. That keeps the tool fast, free, and private. LazyAI itself uses AI to write full posts." },
        { q: "Can I use the ideas as they are?", a: "Treat them as starting points. Add your own details, photos, and tone so the post sounds like you and not like a template." },
        { q: "How many posts do I need each week?", a: "That depends on how much time you have and what you can keep up. A steady schedule you can maintain beats a burst that fades. Our guide on posting frequency explains how to choose." },
        { q: "Is my information stored?", a: "No. Everything you type stays in your browser and is not sent to our servers." },
      ]}
    >
      <PostIdeaTool />
    </ToolShell>
  );
}
