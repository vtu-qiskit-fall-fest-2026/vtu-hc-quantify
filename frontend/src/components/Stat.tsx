import React from 'react';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  variant?: 'default' | 'accent' | 'ok' | 'warn' | 'bad';
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  subtext,
  variant = 'default',
  className = '',
}) => {
  const colorMap = {
    default: 'text-text',
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
  };

  return (
    <div className={`flex flex-col select-text ${className}`}>
      <span className="text-[11px] font-medium tracking-wider text-text-2 uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span
          className={`font-mono text-xl tabular-nums font-semibold ${colorMap[variant]}`}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-text-3 font-normal">
            {unit}
          </span>
        )}
      </div>
      {subtext && (
        <span className="text-[11px] text-text-3 mt-0.5 font-mono">
          {subtext}
        </span>
      )}
    </div>
  );
};
