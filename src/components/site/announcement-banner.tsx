"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { noticeKey, type NoticeTone } from "@/lib/notices";
import { cn } from "@/lib/utils";

const TONES: Record<NoticeTone, string> = {
  info: "bg-brand-50 text-brand-700 border-brand-100",
  success: "bg-emerald-50 text-emerald-800 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
};

/**
 * A slim message above the page. A visitor can close it; it stays closed for the rest of that browser session
 * and comes back when the text changes. When the browser cannot remember (private mode), it simply shows again.
 */
export function AnnouncementBanner({
  text,
  tone,
  linkLabel,
  linkUrl,
  preview = false,
}: {
  text: string;
  tone: NoticeTone;
  linkLabel: string;
  linkUrl: string;
  /** In the admin preview the close button does nothing. */
  preview?: boolean;
}) {
  const storageKey = `lazyai_notice_${noticeKey(text)}`;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (preview) return;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") setHidden(true);
    } catch {
      // Storage can be blocked. The banner then shows on every page, which is fine.
    }
  }, [storageKey, preview]);

  if (hidden) return null;

  const isInternal = linkUrl.startsWith("/");
  const linkClass = "font-semibold underline underline-offset-2";
  return (
    <div role="region" aria-label="Announcement" className={cn("border-b px-4 py-2.5 text-sm", TONES[tone])}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
        <p className="text-center">
          {text}
          {linkUrl && linkLabel ? (
            <>
              {" "}
              {isInternal ? (
                <Link href={linkUrl} className={linkClass}>
                  {linkLabel}
                </Link>
              ) : (
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {linkLabel}
                </a>
              )}
            </>
          ) : null}
        </p>
        <button
          type="button"
          aria-label="Close announcement"
          onClick={() => {
            setHidden(true);
            if (preview) return;
            try {
              window.sessionStorage.setItem(storageKey, "1");
            } catch {
              // Not remembered. Fine.
            }
          }}
          className="shrink-0 rounded-md p-1 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
