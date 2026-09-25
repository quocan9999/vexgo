'use client';

import {
  AdminDialogPrimitive,
  type AdminDialogPrimitiveProps,
} from './admin-dialog-primitive';

type AdminConfirmDialogProps = Omit<
  AdminDialogPrimitiveProps,
  'className' | 'contentClassName' | 'contentElement'
>;

export function AdminConfirmDialog(props: AdminConfirmDialogProps) {
  return (
    <AdminDialogPrimitive
      {...props}
      className="admin-dialog admin-confirm-dialog"
      contentClassName="admin-confirm-dialog__panel"
    />
  );
}
