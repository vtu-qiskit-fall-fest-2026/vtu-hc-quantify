import React from 'react';

export interface ChipProps {
  label: string;
  variant?: 'greenSoft' | 'tile' | 'mint' | 'quantum';
  dot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'greenSoft',
  dot = false,
  dotColor,
  icon,
  className = '',
  onClick,
}) => {
  const variantStyles = {
    greenSoft: 'bg-greenSoft text-green font-semibold',
    tile: 'bg-tile text-ink2 border border-line font-medium',
    mint: 'bg-tileMint text-ink font-medium',
    quantum: 'bg-quantum/20 text-teal-700 dark:text-teal-300 font-semibold',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-[11px] font-ui transition-colors select-none ${
        variantStyles[variant]
      } ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor || 'currentColor' }}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </div>
  );
};
