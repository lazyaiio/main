import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; name: string }) {
  const id = `field-${props.name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} {...props} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={inputClass}>
        {children}
      </select>
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
        {state.message}
      </p>
    );
  }
  return null;
}

export function SubmitButton({
  pending,
  pendingLabel = "Please wait…",
  compact = false,
  children,
}: {
  pending: boolean;
  pendingLabel?: string;
  /** Smaller, content-width button (used in admin cards). */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      size={compact ? "md" : "lg"}
      className={compact ? undefined : "w-full"}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function TextAreaField({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; name: string }) {
  const id = `field-${props.name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(inputClass, "h-auto py-2.5")}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-700">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-50"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="h-4 w-4 accent-brand"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
