import type { Metadata } from "next";
import { TimezoneTool } from "@/components/tools/timezone-tool";
import { ToolShell } from "@/components/tools/tool-shell";
import { pageMetadata } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools/time-zone-converter");
}

export default function Page() {
  return (
    <ToolShell
      path="/tools/time-zone-converter"
      name="Post Time Zone Converter"
      headline="Post time zone converter"
      intro="Pick a posting time and see what time it is for your audience in other time zones. Handles daylight saving changes. Free and private."
      category="scheduling-and-ai"
      steps={["Choose the date and the time you plan to post.", "Pick the time zone that time is in, usually your own.", "Tick the places where your audience lives.", "Read each local time and adjust your plan if a time is too early or too late."]}
      tips={["Schedule in the time zone where most of your customers live, not the one you live in.", "Check the date column. A good time for you can be the next day or the day before for someone else.", "Check dates near a daylight saving change. Clocks in different countries change on different days.", "Watch your own results to learn when your audience is really online, instead of trusting a general rule."]}
      faq={[
        { q: "Why does the date change for some places?", a: "When it is evening in one place it can already be the next morning in another. The table marks the next day or the previous day for you." },
        { q: "Does it handle daylight saving time?", a: "Yes. It uses the time zone data built into your browser, so each place uses its own rules for the date you choose." },
        { q: "What if a time does not exist on a clock-change day?", a: "Clocks skip an hour on some dates. The tool moves that time forward to the next valid one and tells you. A repeated hour uses the first time." },
        { q: "Is my information stored?", a: "No. The conversion runs in your browser and nothing is sent to us." },
      ]}
    >
      <TimezoneTool />
    </ToolShell>
  );
}
