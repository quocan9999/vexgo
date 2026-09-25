'use client';

import {
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
  type ReactNode,
  type SyntheticEvent,
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
      ref={dialogRef}
    >
      <Content className={contentClassName}>{children}</Content>
    </dialog>
  );
}
