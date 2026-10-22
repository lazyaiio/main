"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

/** Submit button for plain forms: disables itself and shows a label while the action runs. */
export function PendingButton({
  children,
  pendingLabel,
  variant = "secondary",
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "dark" | "light";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
