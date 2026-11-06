import { describe, expect, it } from "vitest";
import {
  LIMITS,
  cleanLine,
  cleanText,
  isSupportStatus,
  isValidEmail,
  looksLikeSpam,
  noteSchema,
  parseContactForm,
  replySchema,
  replySubject,
  statusSchema,
} from "./support";

const good = { name: "Rahim Uddin", email: "Rahim@Example.com ", topic: "support", subject: "Facebook Page", message: "My Page will not connect, please help." };

describe("parseContactForm", () => {
  it("accepts a good message and cleans it", () => {
    const parsed = parseContactForm(good);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.email).toBe("rahim@example.com");
      expect(parsed.value.name).toBe("Rahim Uddin");
    }
  });

  it("allows a message written in Bengali (customers may write in any language)", () => {
    const bengali = "\u0986\u09ae\u09be\u09b0 \u09aa\u09c7\u099c \u09b8\u0982\u09af\u09c1\u0995\u09cd\u09a4 \u09b9\u099a\u09cd\u099b\u09c7 \u09a8\u09be, \u09b8\u09be\u09b9\u09be\u09af\u09cd\u09af \u09a6\u09bf\u09a8";
    expect(parseContactForm({ ...good, message: bengali }).ok).toBe(true);
  });

  it("explains each problem in plain words", () => {
    const bad = (patch: Record<string, unknown>) => {
      const r = parseContactForm({ ...good, ...patch });
      return r.ok ? "" : r.error;
    };
    expect(bad({ name: "  " })).toMatch(/name/);
    expect(bad({ email: "nope" })).toMatch(/email/);
    expect(bad({ topic: "spam" })).toMatch(/about/);
    expect(bad({ message: "short" })).toMatch(/at least 10/);
    expect(bad({ message: "x".repeat(LIMITS.message + 1) })).toMatch(/4,000/);
    expect(bad({ subject: "s".repeat(LIMITS.subject + 1) })).toMatch(/subject/);
    expect(bad({ name: "n".repeat(LIMITS.name + 1) })).toMatch(/name/);
  });

  it("never lets a line break into the name or subject (no header tricks)", () => {
    const r = parseContactForm({ ...good, name: "Ann\r\nBcc: boss@example.com", subject: "Hi\nthere" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).not.toMatch(/[\r\n]/);
      expect(r.value.subject).not.toMatch(/[\r\n]/);
    }
  });

  it("ignores values that are not text", () => {
    expect(parseContactForm({}).ok).toBe(false);
    expect(parseContactForm({ ...good, message: 42 }).ok).toBe(false);
  });
});

describe("email and text helpers", () => {
  it("checks email addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    for (const bad of ["a@b", "a b@c.com", "a@@b.com", "<a@b.com>", "a@b.com,c@d.com", "", `${"a".repeat(250)}@b.com`]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });

  it("cleans control characters and unifies line breaks", () => {
    expect(cleanText("a\r\nb\u0007c\u0000d  ")).toBe("a\nbcd");
    expect(cleanLine("a\nb\tc", 10)).toBe("a b c");
    expect(cleanLine("x".repeat(50), 10)).toHaveLength(10);
  });
});

describe("looksLikeSpam", () => {
  const now = 1_800_000_000_000;
  it("passes a person who took a few seconds", () => {
    expect(looksLikeSpam({ website: "", startedAt: String(now - 20_000), message: "Hello there, I need help." }, now)).toBe(false);
  });
  it("catches the hidden box, speed, missing or old timestamps, and link floods", () => {
    expect(looksLikeSpam({ website: "http://x.com", startedAt: String(now - 20_000), message: "Hello" }, now)).toBe(true);
    expect(looksLikeSpam({ website: "", startedAt: String(now - 500), message: "Hello" }, now)).toBe(true);
    expect(looksLikeSpam({ website: "", startedAt: undefined, message: "Hello" }, now)).toBe(true);
    expect(looksLikeSpam({ website: "", startedAt: "abc", message: "Hello" }, now)).toBe(true);
    expect(looksLikeSpam({ website: "", startedAt: String(now - 8 * 24 * 3600 * 1000), message: "Hello" }, now)).toBe(true);
    const links = "http://a.com http://b.com https://c.com www.d.com";
    expect(looksLikeSpam({ website: "", startedAt: String(now - 20_000), message: links }, now)).toBe(true);
  });
});

describe("admin inputs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("checks replies, notes and statuses", () => {
    expect(replySchema.safeParse({ id, body: "Thanks for writing. We fixed it." }).success).toBe(true);
    expect(replySchema.safeParse({ id, body: "ok" }).success).toBe(false);
    expect(replySchema.safeParse({ id: "x", body: "Thanks for writing." }).success).toBe(false);
    expect(noteSchema.safeParse({ id, note: "" }).success).toBe(true);
    expect(noteSchema.safeParse({ id, note: "n".repeat(LIMITS.note + 1) }).success).toBe(false);
    expect(statusSchema.safeParse({ id, status: "closed" }).success).toBe(true);
    expect(statusSchema.safeParse({ id, status: "deleted" }).success).toBe(false);
    expect(isSupportStatus("open")).toBe(true);
    expect(isSupportStatus("nope")).toBe(false);
  });

  it("builds a one-line reply subject", () => {
    expect(replySubject({ subject: "Re: Re: Facebook Page", topic: "support" })).toBe("Re: Facebook Page");
    expect(replySubject({ subject: "", topic: "privacy" })).toBe("Re: Privacy or data request");
    expect(replySubject({ subject: "A\nB", topic: "support" })).toBe("Re: A B");
  });
});
