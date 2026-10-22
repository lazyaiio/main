import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.ts$/.test(f));
const rel = (f: string) => relative(SRC, f).split("\\").join("/");

describe("site copy rules", () => {
  it("contains no Bengali characters in any source file (the site UI is English only)", () => {
    const offenders = sources.filter((f) => /[\u0980-\u09FF]/.test(readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("uses American spelling and date formats", () => {
    // Display strings only: internal status identifiers such as "cancelled" are allowed.
    const words = /finalis|organis|colour|behaviour|favour|licence|programme|catalogue|honour|customis|personalis|summaris|recognis|authoris|optimis|prioritis|minimis|utilis|normalis|en-GB/i;
    const labels = /"Cancelled"|>Cancelled</;
    const offenders = sources.filter((f) => {
      const text = readFileSync(f, "utf8");
      return words.test(text) || labels.test(text);
    });
    expect(offenders.map(rel)).toEqual([]);
  });
});
