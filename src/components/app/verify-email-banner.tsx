import { resendVerificationAction } from "@/app/app/verify-actions";
import { PendingButton } from "@/components/ui/pending-button";

/** Shown on every page of the app until the email is verified. */
export function VerifyEmailBanner({ email }: { email: string | undefined }) {
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-900">
          <strong>One more step: verify your email.</strong> We sent a link to {email ?? "your email address"}. Open it to activate your account. Until then you can look around, but you cannot create or change anything.
        </p>
        <form action={resendVerificationAction}>
          <PendingButton pendingLabel="Sending…">Send the link again</PendingButton>
        </form>
      </div>
    </div>
  );
}
