import React from 'react';

export type PillButtonVariant = 'primary' | 'secondary' | 'mint' | 'deep' | 'ghost' | 'quantum';
export type PillButtonSize = 'sm' | 'md' | 'lg';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
}

export const PillButton: React.FC<PillButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const variantStyles: Record<PillButtonVariant, string> = {
    primary: 'pill-btn--primary bg-green hover:bg-greenHover text-white border border-green shadow-hairline',
    secondary: 'pill-btn--secondary bg-tile text-ink border border-line hover:bg-greenSoft hover:border-line/80',
    mint: 'pill-btn--mint bg-tileMint text-ink border border-line/60 hover:bg-tileSage',
    deep: 'pill-btn--deep bg-tileDeep text-onDeep border border-tileDeep hover:bg-greenHover',
    ghost: 'bg-transparent text-ink hover:bg-greenSoft',
    quantum: 'bg-quantum hover:opacity-95 text-white border border-quantum shadow-hairline',
  };

  const sizeStyles: Record<PillButtonSize, string> = {
    sm: '!h-8 !px-3.5 text-xs gap-1.5',
    md: '!h-11 !px-5 text-xs font-semibold gap-2',
    lg: '!h-12 !px-7 text-sm font-semibold gap-2.5',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`pill-btn rounded-pill font-ui transition-all duration-150 select-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
};
