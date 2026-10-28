import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVICE_ERROR_MESSAGES } from "@/lib/service-messages";
import { describeScheduleError } from "@/lib/schedule-text";
import { SMOKE_PAGES } from "@/lib/deployment-checks";
import { approvalStatus, campaignStatus, postStatus, slotStatus } from "@/lib/status";

/** Release checks that read the source tree: they guard accessibility and message quality from now on. */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const tsx = files.filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, "/");

describe("failure messages", () => {
  it("every service error has a short, plain sentence", () => {
    for (const [kind, message] of Object.entries(SERVICE_ERROR_MESSAGES)) {
      expect(message.length, kind).toBeGreaterThan(15);
      expect(message.length, kind).toBeLessThan(260);
      expect(/[.!?]$/.test(message), `${kind} should end with a full stop`).toBe(true);
      expect(/_|Error:|undefined|null|\{|\}/.test(message), `${kind} must not show code words`).toBe(false);
    }
  });

  it("every publishing failure code has its own explanation, never the generic fallback", () => {
    const generic = describeScheduleError("some_code_nobody_wrote");
    const codes = [
      "uncertain_result",
      "missed_window",
      "not_approved",
      "post_missing",
      "page_missing",
      "page_disconnected",
      "token_missing",
      "token_unreadable",
      "rate_limited",
      "temporary",
      "image_download",
      "not_configured",
      "permission_missing",
      "token_expired",
      "page_access_lost",
      "content_rejected",
      "invalid_request",
    ];
    for (const code of codes) {
      const text = describeScheduleError(code);
      expect(text, code).not.toBeNull();
      expect(text, code).not.toBe(generic);
      expect(/_/.test(text ?? ""), `${code} must not leak the code`).toBe(false);
    }
    expect(describeScheduleError(null)).toBeNull();
  });

  it("every code written by the publisher has an explanation", () => {
    const written = new Set<string>();
    const sources = ["lib/services/publisher.ts", "lib/publish-dispatch.ts"].map((p) => read(join(SRC, p)));
    for (const text of sources) {
      for (const m of text.matchAll(/(?:PrepareError\(|code: |finishFailed\(post, )"([a-z_]+)"/g)) written.add(m[1]);
    }
    const generic = describeScheduleError("some_code_nobody_wrote");
    // "unexpected" is the deliberate catch-all: it is shown with the generic retry-or-reconnect advice.
    const catchAll = new Set(["unexpected"]);
    expect(written.size).toBeGreaterThan(3);
    for (const code of written) {
      if (catchAll.has(code)) continue;
      expect(describeScheduleError(code), code).not.toBe(generic);
    }
  });
});

describe("status labels", () => {
  /** Reads the allowed values of a status column straight from the SQL migrations. */
  function sqlValues(file: string, column: string, table: string): string[] {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8");
    const start = sql.indexOf(`create table public.${table}`);
    expect(start, `${table} in ${file}`).toBeGreaterThan(-1);
    const block = sql.slice(start, start + 4000);
    const match = block.match(new RegExp(`${column} text not null default '[a-z_]+' check \\(\\s*${column} in \\(([^)]*)\\)`));
    expect(match, `${column} check in ${table}`).not.toBeNull();
    return [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string).sort();
  }

  it("every status a row can have is shown with a human label", () => {
    const pairs: [string, string, string, string, object][] = [
      ["0002_core_data_model.sql", "approval_status", "content_items", "post approval", approvalStatus],
      ["0002_core_data_model.sql", "status", "campaigns", "campaign", campaignStatus],
      ["0002_core_data_model.sql", "status", "scheduled_posts", "scheduled post", postStatus],
      ["0005_campaign_planner.sql", "status", "campaign_slots", "campaign slot", slotStatus],
    ];
    for (const [file, column, table, name, map] of pairs) {
      expect(Object.keys(map).sort(), name).toEqual(sqlValues(file, column, table));
      for (const meta of Object.values(map) as { label: string }[]) {
        expect(/^[A-Z][A-Za-z ]+$/.test(meta.label), `${name}: "${meta.label}" should be plain words`).toBe(true);
      }
    }
  });
});

describe("accessibility guards", () => {
  it("every image has an alt attribute", () => {
    for (const f of tsx) {
      for (const m of read(f).matchAll(/<img\b[^>]*>/g)) expect(/\balt=/.test(m[0]), `${rel(f)}: ${m[0].slice(0, 60)}`).toBe(true);
    }
  });

  it("the page language is set and zooming is never blocked", () => {
    const layout = read(join(SRC, "app/layout.tsx"));
    expect(/<html lang="en-US"/.test(layout)).toBe(true);
    expect(/maximumScale|userScalable/.test(layout)).toBe(false);
  });

  it("every page has a skip link target, and the skip link is the first thing in the body", () => {
    const layout = read(join(SRC, "app/layout.tsx"));
    expect(/<body[^>]*>\s*<SkipLink \/>/.test(layout)).toBe(true);
    for (const f of tsx) {
      for (const m of read(f).matchAll(/<main\b[^>]*>/g)) expect(m[0].includes('id="main-content"'), rel(f)).toBe(true);
    }
  });

  it("low-contrast gray text is only used for icons or on the dark section", () => {
    const allowedDark = new Set(["components/marketing/post-formats.tsx"]);
    for (const f of tsx) {
      const lines = read(f).split("\n");
      lines.forEach((line, index) => {
          // An icon can carry its class and aria-hidden on neighboring lines of the same tag.
          const nearby = lines.slice(Math.max(0, index - 1), index + 3).join(" ");
          if (/\btext-ink-(300|400)\b/.test(line) && !/aria-hidden/.test(nearby) && !allowedDark.has(rel(f))) {
            throw new Error(`${rel(f)}:${index + 1} uses gray text with too little contrast; use text-ink-500 or darker`);
          }
        });
    }
  });

  it("links that open a new tab are safe", () => {
    for (const f of tsx) {
      for (const m of read(f).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) expect(/rel="[^"]*noopener|rel="[^"]*noreferrer/.test(m[0]), rel(f)).toBe(true);
    }
  });

  it("motion is switched off for people who ask for less of it", () => {
    expect(/prefers-reduced-motion: reduce[\s\S]*transition-duration/.test(read(join(SRC, "app/globals.css")))).toBe(true);
  });
});

describe("release smoke list", () => {
  it("every public page in the smoke list exists in the app", () => {
    for (const { href } of SMOKE_PAGES) {
      if (href === "/") continue;
      const path = href.replace(/^\//, "");
      const candidates = [
        join(SRC, "app", "(marketing)", path, "page.tsx"),
        join(SRC, "app", path, "page.tsx"),
        join(SRC, "app", path, "route.ts"),
        join(SRC, "app", `${path.replace(/\.(txt|xml)$/, "")}.ts`),
      ];
      expect(candidates.some((c) => existsSync(c)), href).toBe(true);
    }
  });
});
