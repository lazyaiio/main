import { describe, expect, it } from "vitest";
import { decideRoute } from "./route-guard";

describe("decideRoute", () => {
  it("sends signed-out visitors from protected pages to login, remembering the target", () => {
    expect(decideRoute({ pathname: "/app/content", search: "?a=1", isAuthed: false })).toEqual({
      type: "redirect",
      pathname: "/auth/login",
      search: `?next=${encodeURIComponent("/app/content?a=1")}`,
    });
    expect(decideRoute({ pathname: "/onboarding", isAuthed: false }).type).toBe("redirect");
  });

  it("lets signed-in users through protected pages", () => {
    expect(decideRoute({ pathname: "/app", isAuthed: true })).toEqual({ type: "next" });
  });

  it("sends signed-in users away from login and signup", () => {
    expect(decideRoute({ pathname: "/auth/login", isAuthed: true })).toEqual({
      type: "redirect",
      pathname: "/app",
    });
    expect(decideRoute({ pathname: "/auth/signup", isAuthed: true }).type).toBe("redirect");
  });

  it("never blocks the callback or password-reset pages", () => {
    expect(decideRoute({ pathname: "/auth/callback", isAuthed: true })).toEqual({ type: "next" });
    expect(decideRoute({ pathname: "/auth/reset-password", isAuthed: true })).toEqual({ type: "next" });
    expect(decideRoute({ pathname: "/auth/login", isAuthed: false })).toEqual({ type: "next" });
  });

  it("does not treat look-alike paths as protected", () => {
    expect(decideRoute({ pathname: "/application", isAuthed: false })).toEqual({ type: "next" });
  });
});
