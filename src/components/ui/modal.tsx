"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
};

/**
 * Modal sobre o <dialog> nativo: foco preso, ESC fecha, título anunciado,
 * foco devolvido ao elemento que abriu. No celular vira folha presa embaixo.
 */
export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-xl bg-white p-0 text-ink shadow-[var(--shadow-float)] open:animate-rise",
        "sm:m-auto sm:rounded-[var(--radius-panel)]",
        size === "sm" ? "sm:max-w-md" : "sm:max-w-lg",
      )}
    >
      {open && (
        <div className="max-h-[90dvh] overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-bold text-ink">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-[15px] text-ink-2">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-2 transition-colors hover:bg-mist-2 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
