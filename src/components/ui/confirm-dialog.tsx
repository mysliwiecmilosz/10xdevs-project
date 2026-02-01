import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    title,
    description,
    confirmLabel = "Potwierdź",
    cancelLabel = "Anuluj",
    confirmVariant = "default",
    isConfirming = false,
    onConfirm,
    onOpenChange,
  } = props;

  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (open) return;
    lastActiveRef.current?.focus?.();
    lastActiveRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="text-sm text-neutral-600">
              {description}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Usuwam..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

