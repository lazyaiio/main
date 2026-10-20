import { describe, expect, it } from "vitest";
import { appSections, siteConfig } from "./site";

describe("siteConfig", () => {
  it("only links to internal paths or anchors", () => {
    for (const link of [...siteConfig.nav, ...siteConfig.footer]) {
      expect(link.href.startsWith("/")).toBe(true);
    }
  });

  it("has a title and description for every app section", () => {
    for (const section of Object.values(appSections)) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.description.length).toBeGreaterThan(0);
    }
  });
});
