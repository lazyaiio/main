import type { Metadata } from "next";
import { CalendarTool } from "@/components/tools/calendar-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/content-calendar-generator");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/content-calendar-generator"
      name="Facebook Content Calendar Generator"
      headline="Facebook content calendar generator"
      intro="Choose a start date, how many weeks to plan, and the days you can post. Get a complete calendar with a theme and a prompt for every post, and download it as a CSV file."
      category="content-planning"
      steps={["Choose the date your plan should start and how many weeks it should cover.", "Choose how many posts per week and which weekdays you can post on.", "Select the themes you want to rotate through.", "Review the calendar, then download the CSV and fill in the last column with your post text."]}
      tips={["Start smaller than you think you need. Two or three posts a week that you really publish are better than seven you skip.", "Keep the themes that fit your business and remove the rest. Fewer themes make planning faster.", "Open the CSV in a spreadsheet and add a column for the photo or link each post needs.", "Review the plan once a month and keep the themes that got the best response."]}
      faq={[
        { q: "What time should I choose?", a: "Pick a time when your audience is likely to be online, then check your Page Insights after a few weeks and adjust. The time in the calendar is only a reminder; it does not schedule anything by itself." },
        { q: "Does the calendar post for me?", a: "No. It is a plan. To write posts from a plan and schedule them to your Facebook Page, you can use LazyAI." },
        { q: "Can I plan more than twelve weeks?", a: "The tool is limited to twelve weeks so the plan stays realistic. Run it again later for the next stretch." },
        { q: "Is my information stored?", a: "No. The calendar is built in your browser and the CSV file is created on your device." },
      ]}
    >
      <CalendarTool />
    </ToolShell>
  );
}
