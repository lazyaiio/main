import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign up", robots: { index: false } };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Create your account</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        Sign-up is not open yet. In the meantime you can look around the dashboard preview.
      </p>
      <div className="mt-6 grid gap-2">
        <ButtonLink href="/app">Open dashboard preview</ButtonLink>
        <ButtonLink href="/" variant="ghost">
          Back to home
        </ButtonLink>
      </div>
    </>
  );
}
