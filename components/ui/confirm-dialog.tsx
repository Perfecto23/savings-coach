"use client";

import { useEffect, useId, useRef, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

function focusPageHeadingIfNeeded(dialog: HTMLDialogElement) {
  requestAnimationFrame(() => {
    if (dialog.open) return;

    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;

    const hadTabIndex = heading.hasAttribute("tabindex");
    if (!hadTabIndex) heading.tabIndex = -1;
    heading.focus();

    if (!hadTabIndex) {
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), {
        once: true,
      });
    }
  });
}

export function ConfirmDialog({
  open,
  description,
  onCancel,
  onConfirm,
  title = "确认删除",
  confirmLabel = "确认删除",
  cancelLabel = "取消",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      onCancel();
      if (dialog) focusPageHeadingIfNeeded(dialog);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-stone-200 bg-white p-0 text-stone-950 shadow-2xl backdrop:bg-stone-950/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-stone-600">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            autoFocus
            className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "正在删除…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
