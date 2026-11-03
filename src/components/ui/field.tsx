import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[var(--radius-control)] border bg-white px-3 text-[16px] text-ink placeholder:text-ink-3/80 " +
  "transition-[border-color,box-shadow] duration-150 focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300 " +
  "disabled:bg-mist disabled:text-ink-3";

type FieldShellProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function FieldShell({ label, error, hint, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-[13px] font-normal text-ink-3">opcional</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-sm text-berry-700">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export function InputField({ label, error, hint, optional, className, ...props }: InputFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, "h-11", invalid ? "border-berry-600" : "border-line-strong", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export function TextareaField({ label, error, hint, optional, className, ...props }: TextareaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, "min-h-24 py-2.5 leading-6", invalid ? "border-berry-600" : "border-line-strong", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/** Depois de uma validação que falhou, leva o foco ao primeiro campo com erro. */
export function focusFirstError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
