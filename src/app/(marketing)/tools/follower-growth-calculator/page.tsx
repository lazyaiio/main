import type { Metadata } from "next";
import { GrowthTool } from "@/components/tools/growth-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/follower-growth-calculator");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/follower-growth-calculator"
      name="Facebook Follower Growth Calculator"
      headline="Follower growth calculator"
      intro="Enter your follower count at the start and end of a period. See your net growth, growth rate, and average gain per day and per week."
      category="content-planning"
      steps={["Write down your follower count today and from some days ago, for example four weeks.", "Enter both counts and the number of days between them.", "Read the growth, the rate, and the average per day and week.", "Repeat every month and compare with your own earlier results."]}
      tips={["Compare the same length of time each month so the numbers line up.", "Look at what you posted in your best weeks. Growth often follows a few specific posts.", "A small Page can show a large percentage from a few new followers. Look at the raw numbers too.", "Treat the look-ahead as a rough guide only. Growth is uneven and can go down."]}
      faq={[
        { q: "How is growth worked out?", a: "Net growth is the end count minus the start count. The rate is that change divided by the start count. Per day is the net growth divided by the days between the counts." },
        { q: "What does the look-ahead show?", a: "It continues the same number of new followers per day. That is simple arithmetic and not a prediction. Your real numbers will move up and down." },
        { q: "Where do I find my follower count?", a: "Your Page shows its followers, and Facebook's own Page tools show how the count has changed over time." },
        { q: "Is my data saved?", a: "No. The math runs in your browser and nothing is sent to us." },
      ]}
    >
      <GrowthTool />
    </ToolShell>
  );
}
