"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function PaperSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const node = event.currentTarget;
            if (!(node instanceof HTMLElement)) return;
            window.setTimeout(() => {
              node.querySelector<HTMLElement>("input, select, textarea")?.focus();
            }, 30);
          }}
        >
          <Dialog.Close className="sheet-x" aria-label="Close">
            ×
          </Dialog.Close>
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
