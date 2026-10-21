import { describe, expect, it } from "vitest";
import { projectFormSchema, readProjectForm, toProjectSettings } from "./projects";

const base = { name: "Shop tips", inputType: "topic", inputValue: "local marketing", languages: ["en"] };

describe("projectFormSchema", () => {
  it("accepts a topic project", () => {
    expect(projectFormSchema.safeParse(base).success).toBe(true);
  });

  it("requires a real http(s) address for links and websites", () => {
    expect(projectFormSchema.safeParse({ ...base, inputType: "url", inputValue: "example.com" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, inputType: "website", inputValue: "ftp://example.com" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, inputType: "url", inputValue: "javascript:alert(1)" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, inputType: "website", inputValue: "https://example.com" }).success).toBe(true);
  });

  it("rejects missing languages, unknown types, and empty names", () => {
    expect(projectFormSchema.safeParse({ ...base, languages: [] }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, languages: ["fr"] }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, inputType: "csv" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("allows both languages", () => {
    expect(projectFormSchema.safeParse({ ...base, languages: ["en", "bn"] }).success).toBe(true);
  });
});

describe("toProjectSettings", () => {
  it("keeps only the fields that were provided", () => {
    const parsed = projectFormSchema.parse({ ...base, audience: " shop owners ", tone: "friendly" });
    expect(toProjectSettings(parsed)).toEqual({ audience: "shop owners", tone: "friendly" });
  });
});

describe("readProjectForm", () => {
  it("collects repeated language checkboxes", () => {
    const fd = new FormData();
    fd.set("name", "A");
    fd.append("languages", "en");
    fd.append("languages", "bn");
    expect(readProjectForm(fd).languages).toEqual(["en", "bn"]);
  });
});
