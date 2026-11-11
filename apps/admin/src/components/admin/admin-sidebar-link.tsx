'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type AdminSidebarLinkProps = {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tooltipEnabled: boolean;
};

export function AdminSidebarLink({
  active,
  href,
  icon,
  label,
  onClick,
  tooltipEnabled,
}: AdminSidebarLinkProps) {
  return (
    <Tooltip disabled={!tooltipEnabled}>
      <TooltipTrigger
        render={
          <Link
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`sidebar-link${active ? ' is-active' : ''}`}
            href={href}
            onClick={onClick}
          />
        }
      >
        <span aria-hidden="true" className="sidebar-link-icon">
          {icon}
        </span>
        <span>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
