import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezones";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email.")
  .max(254, "That email is too long.")
  .email("Enter a valid email address.");

const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const displayName = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Use 80 characters or fewer.");

export const signUpSchema = z.object({ displayName, email, password: newPassword });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200, "That password is too long."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName,
  workspaceName: z
    .string()
    .trim()
    .min(1, "Enter a workspace name.")
    .max(80, "Use 80 characters or fewer."),
  preferredLanguage: z.enum(["en", "bn"], { message: "Choose a language." }),
  timezone: z.string().refine(isValidTimeZone, { message: "Choose a valid timezone." }),
});

/** First human-readable problem from a Zod error. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your details and try again.";
}
