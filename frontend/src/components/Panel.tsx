import React from 'react';

interface PanelProps {
  title?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  borderLeft?: 'ok' | 'warn' | 'bad' | 'accent' | 'none';
  className?: string;
  bodyClassName?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  headerRight,
  children,
  borderLeft = 'none',
  className = '',
  bodyClassName = 'p-3',
}) => {
  const borderLeftClasses = {
    none: '',
    ok: 'border-l-4 border-l-ok',
    warn: 'border-l-4 border-l-warn',
    bad: 'border-l-4 border-l-bad',
    accent: 'border-l-4 border-l-accent',
  };

  return (
    <div
      className={`border border-line bg-panel rounded-[2px] flex flex-col overflow-hidden ${borderLeftClasses[borderLeft]} ${className}`}
    >
      {title && (
        <div className="h-8 min-h-[32px] px-3 border-b border-line bg-panel-2 flex items-center justify-between text-xs font-medium text-text select-none">
          <div className="flex items-center gap-2 truncate">
            {typeof title === 'string' ? (
              <span className="font-semibold text-text tracking-wide">{title}</span>
            ) : (
              title
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2">{headerRight}</div>
          )}
        </div>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
};
