"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, DatabaseBackup, Search, CreditCard, FileText, Gauge, ImageIcon, LayoutDashboard, LifeBuoy, Mail, Megaphone, Rocket, Send, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "People", icon: Users },
  { href: "/admin/ai-providers", label: "AI providers", icon: Sparkles },
  { href: "/admin/blog", label: "Blog", icon: BookOpen },
  { href: "/admin/seo", label: "SEO", icon: Search },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/pages", label: "Pages", icon: FileText },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/notices", label: "Notices", icon: Megaphone },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/stock-photos", label: "Stock photos", icon: ImageIcon },
  { href: "/admin/publishing", label: "Publishing", icon: Send },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/plans", label: "Plans", icon: Gauge },
  { href: "/admin/backup", label: "Backup", icon: DatabaseBackup },
  { href: "/admin/deployment", label: "Deployment", icon: Rocket },
];

export function AdminNav({ orientation, supportNew = 0 }: { orientation: "vertical" | "horizontal"; supportNew?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin"
      className={cn(orientation === "vertical" ? "flex flex-col gap-1" : "flex gap-1 overflow-x-auto px-3 pb-2")}
    >
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {href === "/admin/support" && supportNew > 0 ? (
              <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                {supportNew > 99 ? "99+" : supportNew}
                <span className="sr-only"> new messages</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
