import type { Metadata } from "next";
import { EngagementTool } from "@/components/tools/engagement-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/engagement-rate-calculator");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/engagement-rate-calculator"
      name="Facebook Engagement Rate Calculator"
      headline="Facebook engagement rate calculator"
      intro="Enter your followers and the reactions, comments, and shares from your recent posts. See your engagement rate by followers and, if you add reach, by reach."
      category="content-planning"
      steps={["Open your Page Insights and pick a period, such as the last 28 days.", "Enter your followers and how many posts the numbers cover.", "Add the total reactions, comments, shares, and link clicks. Add total reach if you have it.", "Read the rates, then repeat next month and compare with your own past results."]}
      tips={["Use the same period and the same method every time, so you compare like with like.", "Compare with your own history first. Other Pages differ in size, topic, and audience.", "Look at your best and worst posts separately. One strong post can lift the average.", "Engagement is a signal, not the goal. Check it against messages, visits, and sales."]}
      faq={[
        { q: "How is engagement rate calculated here?", a: "By followers: the average number of engagements per post divided by your followers, times 100. By reach: total engagements divided by total reach, times 100. Engagements are reactions, comments, shares, and link clicks that you enter." },
        { q: "What is a good engagement rate?", a: "It depends on your Page size, your topic, and how you count. The most useful comparison is with your own earlier results. This tool does not claim an industry average." },
        { q: "Why are there two rates?", a: "The follower rate asks how much of your audience responds. The reach rate asks how much of the people who actually saw your posts responded. They answer different questions." },
        { q: "Is my data saved?", a: "No. The math runs in your browser. Your numbers are not sent to us." },
      ]}
    >
      <EngagementTool />
    </ToolShell>
  );
}
