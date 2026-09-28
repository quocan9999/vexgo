// /src/common/components/ui/ActionDropdown.tsx
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  onClick: () => void;
  disabled?: boolean;
}

interface ActionDropdownProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const ActionDropdown: React.FC<ActionDropdownProps> = ({
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({
    top: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuHeight = menuEl ? menuEl.getBoundingClientRect().height : items.length * 36 + 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      // Prefer opening downwards below the button unless screen bottom is too tight (< 120px) and space above is larger
      if (spaceBelow < 120 && spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = Math.max(8, rect.top - menuHeight - 2);
      } else {
        top = rect.bottom + 2;
      }

      if (align === 'right') {
        const right = Math.max(8, window.innerWidth - rect.right);
        setCoords({ top, right });
      } else {
        const left = Math.max(8, rect.left);
        setCoords({ top, left });
      }
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const getItemStyle = (variant?: string) => {
    switch (variant) {
      case 'danger':
        return 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold';
      case 'warning':
        return 'text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-bold';
      case 'success':
        return 'text-emerald-800 hover:bg-emerald-50 hover:text-brand-dark font-bold';
      default:
        return 'text-slate-700 hover:bg-emerald-50/60 hover:text-brand-dark font-semibold';
    }
  };

  return (
    <div className={`inline-block ${className}`}>
      {/* 3 dots Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
        aria-label="Thao tác"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Render Menu via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
              ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
            }}
            className="z-[99999] w-48 rounded-2xl bg-white shadow-2xl border border-slate-200/90 py-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left cursor-pointer ${getItemStyle(
                  item.variant
                )}`}
              >
                {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
