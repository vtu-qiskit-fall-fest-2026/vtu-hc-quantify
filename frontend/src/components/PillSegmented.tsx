import React from 'react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  tooltip?: string;
  badge?: string;
}

interface PillSegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  size?: 'sm' | 'md';
  variant?: 'light' | 'mint' | 'dark';
  className?: string;
}

export function PillSegmented<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'light',
  className = '',
}: PillSegmentedProps<T>): React.ReactElement {
  const containerVariants = {
    light: 'bg-line/40 border border-line/60',
    mint: 'bg-tileMint/60 border border-line/80',
    dark: 'bg-white/10 border border-white/15',
  };

  const activeVariants = {
    light: 'bg-tile text-ink shadow-hairline border border-line/40 font-semibold',
    mint: 'bg-green text-white shadow-hairline font-semibold',
    dark: 'bg-green text-white shadow-hairline font-semibold',
  };

  const inactiveVariants = {
    light: 'text-ink2 hover:text-ink hover:bg-white/50',
    mint: 'text-ink2 hover:text-ink',
    dark: 'text-onDeep/70 hover:text-onDeep',
  };

  const sizeStyles = {
    sm: 'p-0.5 text-xs h-7',
    md: 'p-1 text-xs h-9',
  };

  return (
    <div
      className={`inline-flex items-center rounded-pill select-none ${
        containerVariants[variant]
      } ${sizeStyles[size]} ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={opt.disabled}
            title={opt.tooltip}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`relative flex items-center justify-center gap-1.5 px-3 h-full rounded-pill transition-all duration-150 font-ui truncate ${
              isActive ? activeVariants[variant] : inactiveVariants[variant]
            } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span>{opt.label}</span>
            {opt.badge && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-quantum text-white font-mono leading-none">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
