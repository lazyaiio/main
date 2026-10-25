/**
 * Facts shown on the legal pages. The three values below come from public settings in Vercel
 * (NEXT_PUBLIC_ variables are not secrets) so the owner can set them without editing code:
 *
 *   NEXT_PUBLIC_OPERATOR_NAME     legal or business name of whoever runs LazyAI (default: LazyAI)
 *   NEXT_PUBLIC_CONTACT_EMAIL     where people can reach you for privacy and support questions
 *   NEXT_PUBLIC_OPERATOR_COUNTRY  country whose law governs the terms, for example "Bangladesh"
 *
 * Change the date below when the policies change in substance.
 */
export const LEGAL_UPDATED_AT = "October 24, 2026";

export function operatorName(): string {
  return process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "LazyAI";
}

export function contactEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function operatorCountry(): string | null {
  return process.env.NEXT_PUBLIC_OPERATOR_COUNTRY?.trim() || null;
}

/** Days within which verified deletion requests are completed. */
export const DELETION_DAYS = 30;

export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Acceptable Use Policy", href: "/acceptable-use" },
  { label: "Cookie Notice", href: "/cookies" },
  { label: "Data Deletion", href: "/data-deletion" },
  { label: "Contact", href: "/contact" },
] as const;
