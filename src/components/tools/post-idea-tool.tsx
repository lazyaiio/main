"use client";

import { useMemo, useState } from "react";
import { BUSINESS_TYPES, GOALS, generateIdeas, type BusinessType, type Goal } from "@/lib/tools/post-ideas";

const field = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-sm font-medium text-ink-700";

export function PostIdeaTool() {
  const [business, setBusiness] = useState<BusinessType>("restaurant");
  const [goal, setGoal] = useState<Goal>("engagement");
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [round, setRound] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const ideas = useMemo(() => generateIdeas({ business, goal, name, product, round }), [business, goal, name, product, round]);

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      // Copying is not available in this browser; the text can still be selected by hand.
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card md:grid-cols-2">
        <label className={label}>
          What kind of business is it?
          <select value={business} onChange={(e) => { setBusiness(e.target.value as BusinessType); setRound(0); }} className={field}>
            {(Object.keys(BUSINESS_TYPES) as BusinessType[]).map((k) => (
              <option key={k} value={k}>{BUSINESS_TYPES[k].label}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          What do you want your posts to do?
          <select value={goal} onChange={(e) => { setGoal(e.target.value as Goal); setRound(0); }} className={field}>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Business name (optional)
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} placeholder="Sunrise Bakery" />
        </label>
        <label className={label}>
          What do you sell or offer? (optional)
          <input value={product} maxLength={60} onChange={(e) => setProduct(e.target.value)} className={field} placeholder="sourdough bread" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Your 12 post ideas</h2>
        <button type="button" onClick={() => setRound((r) => r + 1)} className="h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800">
          Show me different ideas
        </button>
      </div>

      <ol className="grid gap-4 md:grid-cols-2" aria-live="polite">
        {ideas.map((idea, i) => (
          <li key={`${round}-${i}`} className="flex flex-col rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{i + 1}. {idea.title}</p>
            <p className="mt-2 flex-1 text-ink-700">{idea.idea}</p>
            <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
              <span className="font-semibold">Opening line:</span> {idea.opener}
            </p>
            <button type="button" onClick={() => copy(i, `${idea.opener}\n\n${idea.idea}`)} className="mt-3 self-start text-sm font-semibold text-brand hover:underline">
              {copied === i ? "Copied" : "Copy this idea"}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
