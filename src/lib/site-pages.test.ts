import { describe, expect, it } from "vitest";
import { DEFAULT_PAGES } from "@/content/default-pages";
import { parseMarkdown, applyTokens } from "./markdown";
import { BENGALI, EDITABLE_PAGES, buildTokens, validatePageInput } from "./site-pages";

const tokens = buildTokens({ operator: "Acme *Ltd*", country: null, contactEmail: "hi@example.com", deletionDays: 30 });

describe("built-in pages", () => {
  it("has text for every editable page, in English only", () => {
    for (const page of EDITABLE_PAGES) {
      const d = DEFAULT_PAGES[page.slug];
      expect(Boolean(d && d.title && d.body.length > 100)).toBe(true);
      expect(BENGALI.test(`${d?.title}${d?.intro}${d?.body}`)).toBe(false);
    }
  });

  it("only uses known tokens and leaves no stray template code", () => {
    const known = ["operator", "country", "contact_email", "deletion_days", "governing_law", "deletion_check_form"];
    for (const page of EDITABLE_PAGES) {
      const body = DEFAULT_PAGES[page.slug]?.body ?? "";
      for (const m of body.matchAll(/\{\{([a-z_]+)\}\}/g)) expect(known).toContain(m[1] as string);
      expect(/<\/?[a-zA-Z]/.test(body)).toBe(false);
    }
  });

  it("renders every page into blocks", () => {
    for (const page of EDITABLE_PAGES) {
      const blocks = parseMarkdown(applyTokens(DEFAULT_PAGES[page.slug]?.body ?? "", tokens));
      expect(blocks.length).toBeGreaterThan(3);
    }
  });

  it("puts the confirmation code box on the data deletion page", () => {
    expect(parseMarkdown(applyTokens(DEFAULT_PAGES["data-deletion"]?.body ?? "", tokens)).some((b) => b.type === "form")).toBe(true);
  });
});

describe("validatePageInput", () => {
  const ok = { title: "Terms", intro: "", body: "A page with enough words in it to save." };
  it("accepts a normal page", () => {
    expect(validatePageInput(ok)).toBeNull();
  });
  it("refuses an empty title, a tiny body, and Bengali text", () => {
    expect(validatePageInput({ ...ok, title: " " })).not.toBeNull();
    expect(validatePageInput({ ...ok, body: "short" })).not.toBeNull();
    expect(validatePageInput({ ...ok, body: `${ok.body} \u0995\u0996` })).toContain("English");
  });
});

describe("buildTokens", () => {
  it("escapes the operator name and links the email", () => {
    expect(tokens.operator).toBe("Acme \\*Ltd\\*");
    expect(tokens.contact_email).toBe("[hi@example.com](mailto:hi@example.com)");
  });
  it("points to the Contact page when no email is set", () => {
    expect(buildTokens({ operator: "A", country: "Bangladesh", contactEmail: null, deletionDays: 30 }).contact_email).toContain("/contact");
  });
  it("writes the governing law sentence with or without a country", () => {
    expect(buildTokens({ operator: "A", country: "Bangladesh", contactEmail: null, deletionDays: 30 }).governing_law).toContain("laws of Bangladesh");
    expect(tokens.governing_law).toContain("country where the operator");
  });
});
