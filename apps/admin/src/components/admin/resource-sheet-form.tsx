import type { ComponentProps, ReactNode } from 'react';

type ResourceSheetFormProps = Omit<ComponentProps<'form'>, 'className'> & {
  footer: ReactNode;
};

/** Keeps actions outside the field scroll area in a ResourceSheet body. */
export function ResourceSheetForm({
  children,
  footer,
  ...props
}: ResourceSheetFormProps) {
  return (
    <form className="flex h-full min-h-0 flex-col gap-5" {...props}>
      <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-1 py-1">
        {children}
      </div>
      {footer}
    </form>
  );
}
