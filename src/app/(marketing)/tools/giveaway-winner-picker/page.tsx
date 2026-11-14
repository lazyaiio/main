import type { Metadata } from "next";
import { GiveawayTool } from "@/components/tools/giveaway-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/giveaway-winner-picker");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/giveaway-winner-picker"
      name="Giveaway Winner Picker"
      headline="Giveaway winner picker"
      intro="Paste the names of everyone who entered and pick winners and backups at random. Free, private, and nothing leaves your browser."
      category="writing-posts"
      steps={["Write your official rules first, and decide how winners will be picked and told.", "Collect the entries, for example the names of people who commented.", "Paste one entry per line and choose how many winners and backups you want.", "Press Pick winners, take a screenshot for your records, and contact the winners."]}
      tips={["Publish your rules before the giveaway starts, not after it ends.", "Choose backup winners in case someone does not reply in time. Use them in the order shown.", "Count each person once unless your rules clearly say otherwise.", "Check the current rules for promotions on Facebook and the law where you live before you run a giveaway."]}
      faq={[
        { q: "How does the picker choose?", a: "It shuffles your list using your browser's secure random number generator, then takes names from the top. Every different entry has the same chance." },
        { q: "Is my list saved or sent anywhere?", a: "No. Everything happens in your browser, and the list is gone when you close the page." },
        { q: "Can the same person win twice?", a: "No. If a name appears more than once, that person can still be chosen only once." },
        { q: "Does this make my giveaway follow Facebook's rules?", a: "No. The tool only picks names. You are responsible for your rules and for following Meta's policies and the law. Our giveaway guide explains the main points." },
      ]}
    >
      <GiveawayTool />
    </ToolShell>
  );
}
