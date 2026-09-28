// /src/common/components/ui/Badge.tsx
import React from 'react';
import { PostStatus, NeedType } from '../../../config/enums';
import { POST_STATUS_CONFIG, NEED_TYPE_LABELS } from '../../../config/constants';
import {
  CheckCircle2,
  Clock,
  XCircle,
  FileEdit,
  EyeOff,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'status' | 'need' | 'default';
  status?: PostStatus;
  needType?: NeedType;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  status,
  needType,
  className = '',
}) => {
  if (variant === 'status' && status) {
    const config = POST_STATUS_CONFIG[status];
    const iconMap = {
      CheckCircle2: <CheckCircle2 className="w-4 h-4" />,
      Clock: <Clock className="w-4 h-4" />,
      XCircle: <XCircle className="w-4 h-4" />,
      FileEdit: <FileEdit className="w-4 h-4" />,
      EyeOff: <EyeOff className="w-4 h-4" />,
      AlertTriangle: <AlertTriangle className="w-4 h-4" />,
      CheckCheck: <CheckCheck className="w-4 h-4" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${config.badgeClass} ${className}`}
      >
        {iconMap[config.iconName as keyof typeof iconMap]}
        <span>{config.label}</span>
      </span>
    );
  }

  if (variant === 'need' && needType) {
    const isBuy = needType === NeedType.BUY;
    return (
      <span
        className={`inline-flex items-center px-3.5 py-1 rounded-full text-sm font-extrabold uppercase tracking-wide border shadow-sm ${
          isBuy
            ? 'bg-brand text-white border-brand'
            : 'bg-[#D97706] text-white border-[#D97706]'
        } ${className}`}
      >
        {NEED_TYPE_LABELS[needType]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-800 border border-slate-300 ${className}`}
    >
      {children}
    </span>
  );
};
