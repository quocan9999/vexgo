import type { ComponentProps, ReactNode } from 'react';

type ResourceModalFormProps = Omit<ComponentProps<'form'>, 'className'> & {
  footer: ReactNode;
};

/** Giữ các nút thao tác nằm bên ngoài vùng cuộn dữ liệu trong ResourceModalDialog. */
export function ResourceModalForm({
  children,
  footer,
  ...props
}: ResourceModalFormProps) {
  return (
    <form className="flex h-full min-h-0 flex-col gap-5" {...props}>
      <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-1 py-1">
        {children}
      </div>
      {footer}
    </form>
  );
}

export type { ResourceModalFormProps };
