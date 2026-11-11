// Adapted from shadcn/ui base-nova; VexGo theme and interaction contract.
'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 8,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="admin-ui isolate z-[60] data-[anchor-hidden]:invisible"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'flex max-h-(--available-height) w-72 max-w-[calc(100vw-32px)] flex-col gap-4 overflow-y-auto overscroll-contain rounded-[var(--admin-radius-panel)] border bg-popover p-4 text-sm text-popover-foreground shadow-md outline-none',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('shrink-0 text-sm font-semibold', className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
};
