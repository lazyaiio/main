import { ButtonLink } from "@/components/ui/button";

export function NotConfigured() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold">Sign-in is not set up yet</h1>
      <p className="text-sm leading-relaxed text-ink-600">
        This site is still being configured, so accounts are not available right now. Please check
        back soon.
      </p>
      <ButtonLink href="/" variant="secondary">
        Back to home
      </ButtonLink>
    </div>
  );
}
