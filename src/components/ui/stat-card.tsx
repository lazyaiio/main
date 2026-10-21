import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      <p className="text-sm text-ink-500">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-extrabold", tone === "attention" && value > 0 && "text-amber-600")}>
        {value}
      </p>
    </>
  );
  const classes = "block rounded-2xl border border-ink-100 bg-white p-5 shadow-card";
  return href ? (
    <Link href={href} className={cn(classes, "transition-colors hover:border-brand-200")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
