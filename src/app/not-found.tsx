import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mt-3 text-ink-600">The page you are looking for does not exist or has moved.</p>
      <div className="mt-6">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </main>
  );
}
