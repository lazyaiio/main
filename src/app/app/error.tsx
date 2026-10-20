"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink-600">
        We could not load this page. Please try again. If it keeps happening, sign out and back in.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
