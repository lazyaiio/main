import type { Metadata } from "next";
import { PostCheckerTool } from "@/components/tools/post-checker-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/post-checker");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/post-checker"
      name="Facebook Post Checker"
      headline="Facebook post checker"
      intro="Paste a draft and see its length, first line, call to action, hashtags, and how easy it is to read. Get plain suggestions you can act on before you publish."
      category="writing-posts"
      steps={["Paste or type your draft into the box.", "Read the numbers: words, sentences, hashtags, and links.", "Go through the suggestions marked with an exclamation mark and edit the post.", "Check again until the list looks good, then publish."]}
      tips={["Read the first line on its own. If it does not make someone want to read on, rewrite it.", "Say what you want the reader to do next, in plain words.", "Short sentences and short paragraphs read much better on a phone.", "These are general writing guidelines, not Facebook rules. Your own audience and your Page Insights are the final judge."]}
      faq={[
        { q: "Does this check my post against Facebook's rules?", a: "No. It checks writing quality: length, structure, and readability. Always follow Facebook's own policies for what you may post." },
        { q: "What does reading ease mean?", a: "It is a standard score from 0 to 100 that is based on sentence length and word length. Higher means easier to read. For social posts, easy usually works best." },
        { q: "Is my text saved?", a: "No. The analysis runs in your browser. Your text is not sent to us." },
        { q: "Can it write the post for me?", a: "This tool only checks a draft. To have posts written for you, you can use LazyAI." },
      ]}
    >
      <PostCheckerTool />
    </ToolShell>
  );
}
