"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { drawWinners, parseEntries, secureRandomInt, type Draw } from "@/lib/tools/giveaway";

const field = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function GiveawayTool() {
  const [text, setText] = useState("");
  const [unique, setUnique] = useState(true);
  const [winners, setWinners] = useState(1);
  const [backups, setBackups] = useState(1);
  const [draw, setDraw] = useState<{ result: Draw; at: string; entries: number } | null>(null);
  const list = useMemo(() => parseEntries(text, unique), [text, unique]);

  function pick() {
    const result = drawWinners(list.entries, winners, backups, (n) => secureRandomInt(n));
    setDraw({ result, at: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), entries: new Set(list.entries.map((e) => e.toLowerCase())).size });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <label htmlFor="gw-entries" className="text-sm font-medium text-ink-700">Entries, one per line</label>
        <textarea id="gw-entries" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={"Ana Rahman\nBen Carter\nCara Singh"} className={`${field} leading-6`} />
        <p className="mt-1 text-xs text-ink-500">{list.entries.length.toLocaleString("en-US")} entr{list.entries.length === 1 ? "y" : "ies"}{list.duplicates > 0 ? `, ${list.duplicates} repeat${list.duplicates === 1 ? "" : "s"} removed` : ""}{list.tooMany ? ". Only the first 5,000 are used" : ""}.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="gw-winners" className="text-sm font-medium text-ink-700">Winners</label><select id="gw-winners" value={winners} onChange={(e) => setWinners(Number(e.target.value))} className={field}>{[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label htmlFor="gw-backups" className="text-sm font-medium text-ink-700">Backup winners</label><select id="gw-backups" value={backups} onChange={(e) => setBackups(Number(e.target.value))} className={field}>{[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <label className="flex items-end gap-2 pb-2 text-sm text-ink-700"><input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} className="mb-0.5 h-4 w-4 rounded border-ink-300" />Count each name once</label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" onClick={pick} className="h-11 rounded-xl bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-600">Pick winners</button>
          <button type="button" onClick={() => setText("Ana Rahman\nBen Carter\nCara Singh\nDev Patel\nEli Novak\nFatima Noor")} className="text-sm font-semibold text-brand hover:underline">Try an example</button>
          {text ? <button type="button" onClick={() => { setText(""); setDraw(null); }} className="text-sm font-semibold text-ink-600 hover:underline">Clear</button> : null}
        </div>
        <p className="mt-3 text-xs text-ink-500">Your list stays in your browser. Nothing is sent or saved anywhere.</p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!draw ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Paste the names of everyone who entered, then press Pick winners.</p> : null}
        {draw && !draw.result.ok ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{draw.result.error}</p> : null}
        {draw && draw.result.ok ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-ink">Winner{draw.result.winners.length === 1 ? "" : "s"}</p>
            <ol className="mt-2 space-y-1">{draw.result.winners.map((w, i) => <li key={`${w}-${i}`} className="rounded-xl bg-emerald-50 px-3 py-2 font-display text-lg font-bold text-ink">{i + 1}. {w}</li>)}</ol>
            {draw.result.backups.length > 0 ? (<><p className="mt-4 text-sm font-semibold text-ink">Backups, in order</p><ol className="mt-2 space-y-1">{draw.result.backups.map((w, i) => <li key={`${w}-${i}`} className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink">{i + 1}. {w}</li>)}</ol></>) : null}
            <p className="mt-4 text-xs text-ink-500">Drawn {draw.at} from {draw.entries.toLocaleString("en-US")} different entr{draw.entries === 1 ? "y" : "ies"}. Take a screenshot if you want a record.</p>
          </div>
        ) : null}
        <p className="rounded-2xl border border-ink-100 bg-white p-4 text-xs text-ink-600">This tool only picks names. The rules for running a giveaway on Facebook, and the law where you live, are your responsibility. Read <Link href="/blog/facebook-giveaway-rules-for-small-businesses" className="font-semibold text-brand underline">our giveaway guide</Link> before you start.</p>
      </div>
    </div>
  );
}
