import type { ReactElement } from "react";

/**
 * Simple, accurate diagrams for the docs and articles. Each one is an SVG with a text description, uses the site's colors,
 * and carries no data: they show ideas and steps, never invented numbers.
 */

const box = "fill-white stroke-ink-300";
const accent = "fill-brand-50 stroke-brand";

function Frame({ id, title, desc, height, children }: { id: string; title: string; desc: string; height: number; children: React.ReactNode }) {
  return (
    <figure className="my-8">
      <svg viewBox={`0 0 760 ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full rounded-2xl border border-ink-100 bg-white">
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{desc}</desc>
        <defs>
          <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-ink-500" />
          </marker>
        </defs>
        {children}
      </svg>
      <figcaption className="mt-2 text-sm text-ink-600">{title}</figcaption>
    </figure>
  );
}

function Step({ x, y, w = 128, n, label, sub, hot = false }: { x: number; y: number; w?: number; n: number; label: string; sub: string; hot?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={84} rx={14} className={hot ? accent : box} strokeWidth={1.5} />
      <text x={x + 14} y={y + 26} className="fill-brand-700 text-[13px] font-bold">{n}</text>
      <text x={x + 14} y={y + 48} className="fill-ink text-[15px] font-bold">{label}</text>
      <text x={x + 14} y={y + 68} className="fill-ink-600 text-[12px]">{sub}</text>
    </g>
  );
}

function arrowFor(id: string) {
  function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink-500" strokeWidth={1.5} markerEnd={`url(#${id}-arrow)`} />;
  }
  return Arrow;
}

/** Plan, write, review, schedule, publish. */
function Workflow() {
  const Arrow = arrowFor("workflow");
  return (
    <Frame id="workflow" title="How a LazyAI post goes from idea to your Page" desc="Five steps in a row: plan, write, review, schedule, and publish. You review and approve before anything is scheduled." height={150}>
      <Step x={12} y={30} n={1} label="Plan" sub="Topic or link" />
      <Arrow x1={142} y1={72} x2={160} y2={72} />
      <Step x={162} y={30} n={2} label="Write" sub="AI drafts" />
      <Arrow x1={292} y1={72} x2={310} y2={72} />
      <Step x={312} y={30} n={3} label="Review" sub="You edit" hot />
      <Arrow x1={442} y1={72} x2={460} y2={72} />
      <Step x={462} y={30} n={4} label="Schedule" sub="Pick a time" />
      <Arrow x1={592} y1={72} x2={610} y2={72} />
      <Step x={612} y={30} n={5} label="Publish" sub="To your Page" />
      <text x={380} y={132} textAnchor="middle" className="fill-ink-600 text-[12px]">Nothing is published unless you schedule it. You can cancel a scheduled post before it goes out.</text>
    </Frame>
  );
}

/** The life of a scheduled post. */
function Lifecycle() {
  const Arrow = arrowFor("lifecycle");
  const s = (x: number, y: number, w: number, label: string, hot = false) => (
    <g>
      <rect x={x} y={y} width={w} height={40} rx={20} className={hot ? accent : box} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + 25} textAnchor="middle" className="fill-ink text-[14px] font-semibold">{label}</text>
    </g>
  );
  return (
    <Frame id="lifecycle" title="The life of a scheduled post" desc="A post is ready, then scheduled, then publishing. From publishing it becomes published, or failed, or it goes to retrying and tries publishing again. A scheduled post can be canceled before it goes out." height={260}>
      {s(20, 30, 110, "Ready")}
      <Arrow x1={132} y1={50} x2={178} y2={50} />
      {s(180, 30, 120, "Scheduled", true)}
      <Arrow x1={302} y1={50} x2={348} y2={50} />
      {s(350, 30, 130, "Publishing")}
      <Arrow x1={482} y1={50} x2={528} y2={50} />
      {s(530, 30, 130, "Published", true)}
      <Arrow x1={395} y1={72} x2={395} y2={128} />
      <Arrow x1={435} y1={128} x2={435} y2={72} />
      {s(350, 130, 130, "Retrying")}
      <text x={385} y={112} textAnchor="end" className="fill-ink-600 text-[12px]">tries again by itself</text>
      <Arrow x1={470} y1={72} x2={545} y2={128} />
      {s(530, 130, 130, "Failed")}
      <Arrow x1={240} y1={72} x2={240} y2={188} />
      {s(180, 190, 120, "Canceled")}
      <text x={20} y={244} className="fill-ink-600 text-[12px]">Published appears only after Facebook confirms the post. A failed post shows its reason and a retry button.</text>
    </Frame>
  );
}

/** Views, people reached, engagement, clicks. */
function Funnel() {
  const row = (y: number, w: number, label: string, sub: string, hot = false) => (
    <g>
      <rect x={(760 - w) / 2} y={y} width={w} height={52} rx={10} className={hot ? accent : box} strokeWidth={1.5} />
      <text x={380} y={y + 23} textAnchor="middle" className="fill-ink text-[15px] font-bold">{label}</text>
      <text x={380} y={y + 42} textAnchor="middle" className="fill-ink-600 text-[12px]">{sub}</text>
    </g>
  );
  return (
    <Frame id="funnel" title="From being shown to taking action" desc="A way to think about Page numbers. Views are how often content was shown. People reached is how many different people saw it. Engagement is what they did. Clicks are the actions that matter most to a business. The bars show an order of ideas, not real amounts." height={290}>
      {row(20, 640, "Views", "How often your content was shown")}
      {row(84, 520, "People reached", "How many different people saw it")}
      {row(148, 400, "Engagement", "Reactions, comments, shares")}
      {row(212, 280, "Clicks and visits", "The step a business cares about", true)}
      <text x={380} y={282} textAnchor="middle" className="fill-ink-500 text-[11px]">The widths show an order of ideas, not real amounts.</text>
    </Frame>
  );
}

/** A simple weekly rhythm. */
function Rhythm() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const kinds: (string | null)[] = ["Teach", null, "Show", null, "Offer", null, "Ask"];
  return (
    <Frame id="rhythm" title="A light weekly rhythm: four posts, four jobs" desc="An example week with four posts: Monday teach, Wednesday show, Friday offer, Sunday ask. Other days are free for replies." height={170}>
      {days.map((d, i) => (
        <g key={d}>
          <rect x={16 + i * 106} y={24} width={98} height={110} rx={12} className={kinds[i] ? accent : box} strokeWidth={1.5} />
          <text x={65 + i * 106} y={52} textAnchor="middle" className="fill-ink text-[14px] font-bold">{d}</text>
          <text x={65 + i * 106} y={92} textAnchor="middle" className={kinds[i] ? "fill-brand-700 text-[15px] font-bold" : "fill-ink-500 text-[12px]"}>{kinds[i] ?? "Reply"}</text>
        </g>
      ))}
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => ReactElement> = { workflow: Workflow, lifecycle: Lifecycle, funnel: Funnel, rhythm: Rhythm };

export const DIAGRAM_NAMES = Object.keys(DIAGRAMS);

export function Diagram({ name }: { name: string }) {
  const Component = DIAGRAMS[name];
  return Component ? <Component /> : null;
}
