'use client';

import {
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
  type ReactNode,
  type SyntheticEvent,
  type KeyboardEvent,
} from 'react';

export type AdminDialogPrimitiveProps = {
  ariaBusy?: boolean;
  ariaDescribedBy?: string;
  ariaLabelledBy: string;
  children: ReactNode;
  className: string;
  contentClassName: string;
  contentElement?: 'div' | 'section';
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  preventDismiss?: boolean;
};

const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function trapDialogTabFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;

  const dialog = event.currentTarget;
  const activeElement = dialog.ownerDocument.activeElement;
  const focusableElements = Array.from(
    dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
  ).filter((element) => {
    const isVisible =
      element.getClientRects().length > 0 &&
      dialog.ownerDocument.defaultView?.getComputedStyle(element).visibility !==
        'hidden';

    return element.tabIndex >= 0 && !element.matches(':disabled') && isVisible;
  });
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!firstElement || !lastElement) return;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

export function AdminDialogPrimitive({
  ariaBusy,
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className,
  contentClassName,
  contentElement: Content = 'div',
  dialogRef: suppliedDialogRef,
  onClose,
  preventDismiss = false,
}: AdminDialogPrimitiveProps) {
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = suppliedDialogRef ?? internalDialogRef;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [dialogRef]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (preventDismiss) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget && !preventDismiss) {
      event.currentTarget.close();
    }
  }

  return (
    <dialog
      aria-busy={ariaBusy}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      className={className}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onClose={onClose}
      onKeyDown={trapDialogTabFocus}
      ref={dialogRef}
    >
      <Content className={contentClassName}>{children}</Content>
    </dialog>
  );
}
