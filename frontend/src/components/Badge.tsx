import React from 'react';

export type BadgeVariant = 'ok' | 'warn' | 'bad' | 'accent' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  mono?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  className = '',
  mono = false,
}) => {
  const dotColorMap: Record<BadgeVariant, string> = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    accent: 'bg-accent',
    neutral: 'bg-text-3',
  };

  const textColorMap: Record<BadgeVariant, string> = {
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
    accent: 'text-accent',
    neutral: 'text-text-2',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 border border-line bg-panel-2 rounded-[2px] ${className}`}
    >
      <span className={`w-2 h-2 rounded-[1px] flex-shrink-0 ${dotColorMap[variant]}`} />
      <span
        className={`text-xs ${mono ? 'font-mono' : 'font-medium'} ${textColorMap[variant]}`}
      >
        {label}
      </span>
    </div>
  );
};
