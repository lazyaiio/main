"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Plug,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/content", label: "Content", icon: FileText },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/pages", label: "Pages", icon: Plug },
  { href: "/app/media", label: "Media", icon: ImageIcon },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppNav({ orientation, isAdmin = false }: { orientation: "vertical" | "horizontal"; isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]",
      )}
    >
      {(isAdmin ? [...items, { href: "/admin/ai-providers", label: "Admin", icon: Shield, exact: false }] : items).map(({ href, label, icon: Icon, exact }) => {
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
          </Link>
        );
      })}
    </nav>
  );
}
