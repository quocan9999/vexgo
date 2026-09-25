'use client';

import {
  AdminDialogPrimitive,
  type AdminDialogPrimitiveProps,
} from './admin-dialog-primitive';

type AdminDetailSheetProps = Omit<
  AdminDialogPrimitiveProps,
  'className' | 'contentClassName' | 'contentElement'
>;

export function AdminDetailSheet(props: AdminDetailSheetProps) {
  return (
    <AdminDialogPrimitive
      {...props}
      className="admin-dialog admin-detail-sheet"
      contentClassName="admin-detail-sheet__panel"
    />
  );
}
