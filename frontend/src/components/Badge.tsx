import React from 'react';

export type BadgeVariant = 'ok' | 'warn' | 'bad' | 'accent' | 'quantum' | 'neutral' | 'mint';

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
    ok: 'bg-green',
    warn: 'bg-warn',
    bad: 'bg-bad',
    accent: 'bg-green',
    quantum: 'bg-quantum',
    neutral: 'bg-ink3',
    mint: 'bg-green',
  };

  const bgStyles: Record<BadgeVariant, string> = {
    ok: 'bg-greenSoft text-green border-green/30',
    warn: 'bg-warn/15 text-warn border-warn/30',
    bad: 'bg-bad/15 text-bad border-bad/30',
    accent: 'bg-greenSoft text-green border-green/30',
    quantum: 'bg-quantum/15 text-quantum border-quantum/30',
    neutral: 'bg-line/40 text-ink2 border-line/60',
    mint: 'bg-tileMint text-ink border-line/80',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-pill text-xs font-ui ${bgStyles[variant]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColorMap[variant]}`} />
      <span className={`text-[11px] ${mono ? 'font-mono' : 'font-medium'}`}>{label}</span>
    </div>
  );
};
