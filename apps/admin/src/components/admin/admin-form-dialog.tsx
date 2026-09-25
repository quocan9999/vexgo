'use client';

import {
  AdminDialogPrimitive,
  type AdminDialogPrimitiveProps,
} from './admin-dialog-primitive';

type AdminFormDialogProps = Omit<
  AdminDialogPrimitiveProps,
  'className' | 'contentClassName' | 'contentElement'
>;

export function AdminFormDialog(props: AdminFormDialogProps) {
  return (
    <AdminDialogPrimitive
      {...props}
      className="admin-dialog admin-form-dialog"
      contentClassName="admin-form-dialog__panel"
      contentElement="section"
    />
  );
}
