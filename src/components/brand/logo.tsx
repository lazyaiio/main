import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "dark" = dark text for light backgrounds; "light" = white text for dark backgrounds. */
  variant?: "dark" | "light";
  className?: string;
  priority?: boolean;
};

export function Logo({ variant = "dark", className, priority }: LogoProps) {
  return (
    <Image
      src={variant === "light" ? "/brand/logo-light.png" : "/brand/logo.png"}
      alt="LazyAI"
      width={1000}
      height={370}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}
