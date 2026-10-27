import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A simple secret scanner that runs with every test run: no real key, token, or private key may be
 * committed to the project. Test files are skipped because they hold fake sample values on purpose.
 */

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "coverage", "dist"]);
const SCAN_EXT = /\.(ts|tsx|js|mjs|json|md|sql|yml|yaml|env|example|txt|css)$/;

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "Anthropic key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI-style key", regex: /\bsk-[A-Za-z0-9]{32,}/ },
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Resend key", regex: /\bre_[A-Za-z0-9]{20,}/ },
  { name: "Webhook signing secret", regex: /\bwhsec_[A-Za-z0-9+/=]{20,}/ },
  { name: "Facebook access token", regex: /\bEAA[A-Za-z0-9]{30,}/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "JSON web token (for example a Supabase key)", regex: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, out);
    else if (SCAN_EXT.test(name) || name.startsWith(".env")) out.push(path);
  }
  return out;
}

describe("secret scan", () => {
  const files = walk(ROOT).filter((f) => !/\.test\.ts$/.test(f) && !/package-lock\.json$/.test(f));

  it("scans a meaningful number of files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds no real-looking secrets in the project", () => {
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const { name, regex } of PATTERNS) {
        if (regex.test(text)) hits.push(`${relative(ROOT, file)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps .env.example free of values", () => {
    const text = readFileSync(join(ROOT, ".env.example"), "utf8");
    const filled = text
      .split("\n")
      .filter((line) => /^[A-Z][A-Z0-9_]*=.+/.test(line))
      // settings that are public or intentionally shown with an example value
      .filter((line) => !/^(NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SUPABASE_URL|NODE_ENV)=/.test(line));
    expect(filled).toEqual([]);
  });
});
