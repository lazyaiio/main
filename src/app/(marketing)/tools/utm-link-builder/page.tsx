import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/tool-shell";
import { UtmTool } from "@/components/tools/utm-tool";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/utm-link-builder");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/utm-link-builder"
      name="Campaign Link (UTM) Builder"
      headline="Campaign link (UTM) builder"
      intro="Add UTM tags to a web address so your analytics can show which Facebook post or campaign sent each visitor. Free, instant, and private."
      category="content-planning"
      steps={["Paste the web address your post links to.", "Keep the source as facebook and the medium as social, or change them.", "Give the campaign a short name, such as spring-sale.", "Copy the tagged link and use it in your post."]}
      tips={["Always use the same spelling for the same campaign. This tool lowercases values and replaces spaces with hyphens to help.", "Use the content tag to tell two posts in one campaign apart, such as post-1 and post-2.", "Do not put private information in a tag. Anyone who can see the link can read it.", "Tag links you control. Your analytics tool reads the tags when someone lands on your page."]}
      faq={[
        { q: "What are UTM tags?", a: "They are short labels added to the end of a web address, such as utm_source and utm_campaign. Analytics tools read them to show where visitors came from." },
        { q: "Do I need all five?", a: "No. Source, medium, and campaign are the three to start with. Term and content are optional." },
        { q: "What if my link already has UTM tags?", a: "The tool replaces them with the new values and keeps your other parameters and any #section at the end." },
        { q: "Is my link saved?", a: "No. Everything runs in your browser and nothing is sent to us." },
      ]}
    >
      <UtmTool />
    </ToolShell>
  );
}
