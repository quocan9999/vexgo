import React from 'react';

export interface VexGoLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'red' | 'navy' | 'mono';
  size?: number | string;
  showText?: boolean;
  className?: string;
}

/**
 * Biểu tượng Logo VexGo Nhận Diện Thương Hiệu Mới:
 * - Chữ V là một cung đường (hành trình từ A đến B).
 * - Chấm vàng là điểm đến (ghim đích đến trên bản đồ).
 * - Hai khuyết bên hông là mép vé xe khách.
 */
export const VexGoMark: React.FC<{
  size?: number | string;
  variant?: 'white' | 'red' | 'navy' | 'mono';
  className?: string;
}> = ({ size = 32, variant = 'white', className = '' }) => {
  let ticketFill = 'var(--t, #E8272B)';
  let pathStroke = 'var(--v, #FFFFFF)';
  let dotFill = 'var(--d, #FFB81C)';

  if (variant === 'white') {
    ticketFill = '#FFFFFF';
    pathStroke = '#E8272B';
    dotFill = '#FFB81C';
  } else if (variant === 'red') {
    ticketFill = '#E8272B';
    pathStroke = '#FFFFFF';
    dotFill = '#FFB81C';
  } else if (variant === 'navy') {
    ticketFill = '#16224A';
    pathStroke = '#FFFFFF';
    dotFill = '#FFB81C';
  } else if (variant === 'mono') {
    ticketFill = 'currentColor';
    pathStroke = '#FFFFFF';
    dotFill = '#FFFFFF';
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id="vexgo-admin-ticket-notch">
          <rect width="64" height="64" fill="#ffffff" />
          <circle cx="0" cy="32" r="6" fill="#000000" />
          <circle cx="64" cy="32" r="6" fill="#000000" />
        </mask>
      </defs>
      <rect
        width="64"
        height="64"
        rx="18"
        fill={ticketFill}
        mask="url(#vexgo-admin-ticket-notch)"
      />
      <path
        d="M17 19 L31 47 L42 25"
        fill="none"
        stroke={pathStroke}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="17" r="6.5" fill={dotFill} />
    </svg>
  );
};

export const VexGoBrandLockup: React.FC<VexGoLogoProps> = ({
  variant = 'red',
  size = 36,
  showText = true,
  className = '',
  ...props
}) => {
  let textColor = 'text-[#16224A]';
  let goColor = 'text-[#E8272B]';

  if (variant === 'red') {
    textColor = 'text-white';
    goColor = 'text-[#FFB81C]';
  } else if (variant === 'navy') {
    textColor = 'text-white';
    goColor = 'text-[#FFB81C]';
  } else if (variant === 'white') {
    textColor = 'text-[#16224A]';
    goColor = 'text-[#E8272B]';
  } else if (variant === 'mono') {
    textColor = 'text-current';
    goColor = 'text-current';
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight select-none ${className}`}
      {...props}
    >
      <VexGoMark size={size} variant={variant} />
      {showText && (
        <span className={`text-[1.35em] leading-none ${textColor} tracking-[-0.03em]`}>
          vex<b className={`font-extrabold ${goColor}`}>go</b>
        </span>
      )}
    </div>
  );
};

export default VexGoBrandLockup;
