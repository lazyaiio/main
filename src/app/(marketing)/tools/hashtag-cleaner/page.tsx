import type { Metadata } from "next";
import { HashtagTool } from "@/components/tools/hashtag-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/hashtag-cleaner");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/hashtag-cleaner"
      name="Hashtag Cleaner"
      headline="Hashtag cleaner"
      intro="Paste a messy list of hashtags or keywords. Get clean, unique hashtags with no spaces or odd characters, ready to copy into your post."
      category="writing-posts"
      steps={["Paste your hashtags or a list of keywords.", "Choose a style. Capitalizing each word makes long tags easier to read.", "Set a limit if you want only your best few.", "Copy the result and add it to the end of your post."]}
      tips={["Two or three relevant hashtags are usually plenty on Facebook.", "Capitalize each word in long tags, such as #FreshBread, so they are easier to read aloud and on screen readers.", "Make a few tags your own, such as your business name, and use them every time.", "Skip tags that have nothing to do with the post. They do not help and can look spammy."]}
      faq={[
        { q: "What does the cleaner remove?", a: "Spaces and punctuation inside tags, duplicates (ignoring capital letters), empty tags, and tags made only of numbers." },
        { q: "How does it know where one tag ends?", a: "If your text has # signs, each # starts a new tag. Without them, commas and new lines separate tags. If there are none, each word becomes a tag." },
        { q: "Does it work with other languages?", a: "Letters and numbers from other scripts are kept, such as accented letters." },
        { q: "Is my text saved?", a: "No. It stays in your browser." },
      ]}
    >
      <HashtagTool />
    </ToolShell>
  );
}
