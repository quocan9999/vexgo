'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';

/** Shared Admin notification host, adapted from shadcn/ui Sonner. */
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      closeButton
      richColors
      duration={5000}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Thông báo"
      className="admin-ui"
      style={
        {
          '--font-family': 'var(--font-sans)',
          '--border-radius': 'var(--admin-radius-panel)',
        } as CSSProperties
      }
      toastOptions={{
        style: { fontFamily: 'var(--font-sans)', fontSize: '14px' },
        closeButtonAriaLabel: 'Đóng thông báo',
      }}
    />
  );
}
