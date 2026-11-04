"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { FieldShell } from "./field";

type PasswordFieldProps = Omit<ComponentProps<"input">, "id" | "type"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
};

/** Campo de senha com botão para mostrar/esconder o que foi digitado. */
export function PasswordField({ label, error, hint, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              "h-11 w-full rounded-control border bg-white pl-3 pr-12 text-[16px] text-ink placeholder:text-ink-3/80",
              "transition-[border-color,box-shadow] duration-150 focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300",
              invalid ? "border-berry-600" : "border-line-strong",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Esconder senha" : "Mostrar senha"}
            aria-pressed={visible}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-control text-ink-3 transition-colors hover:bg-mist-2 hover:text-ink"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      )}
    </FieldShell>
  );
}
