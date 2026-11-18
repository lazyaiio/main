import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, profileSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/auth/schemas";
import { campaignFormSchema, readCampaignForm } from "@/lib/campaign-plan";
import { contentFormSchema, manualPostSchema } from "@/lib/content";
import { projectFormSchema } from "@/lib/projects";

// Zod 4 words its built-in errors differently from Zod 3. Visitors must only ever see our own sentences
// when they submit a form that is empty or half filled in.
const TECHNICAL = /^(Invalid input|Invalid option|Invalid string|Invalid UUID|Too small|Too big|expected |Required$)/;

function messages(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, input: unknown) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((i) => i.message);
}

describe("form validation messages", () => {
  const cases: [string, Parameters<typeof messages>[0], unknown][] = [
    ["sign up", signUpSchema, { displayName: "", email: "", password: "" }],
    ["sign in", signInSchema, { email: "", password: "" }],
    ["forgot password", forgotPasswordSchema, { email: "" }],
    ["reset password", resetPasswordSchema, { password: "", confirmPassword: "" }],
    ["profile", profileSchema, { displayName: "", workspaceName: "", preferredLanguage: "", timezone: "" }],
    ["content form", contentFormSchema, { body: "" }],
    ["manual post", manualPostSchema, { language: "", body: "" }],
    ["project form", projectFormSchema, { name: "", inputType: "", inputValue: "", languages: [] }],
    ["campaign form", campaignFormSchema, readCampaignForm(new FormData())],
  ];

  for (const [name, schema, input] of cases) {
    it(`shows plain sentences for an empty ${name} form`, () => {
      const list = messages(schema, input);
      expect(list.length).toBeGreaterThan(0);
      for (const m of list) expect(m, m).not.toMatch(TECHNICAL);
    });
  }

  it("still catches mismatched passwords with our own sentence", () => {
    expect(messages(resetPasswordSchema, { password: "longenough1", confirmPassword: "different1" })).toContain("The two passwords do not match.");
  });
});
