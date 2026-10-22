import React from 'react';

export type TileVariant = 'default' | 'mint' | 'sage' | 'deep' | 'ink' | 'outlined';

export interface TileProps {
  children?: React.ReactNode;
  variant?: TileVariant;
  colSpan?: number | string;
  rowSpan?: number | string;
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  padding?: 'normal' | 'dense' | 'none';
  interactive?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  onClick?: () => void;
  id?: string;
}

export const Tile: React.FC<TileProps> = ({
  children,
  variant = 'default',
  colSpan,
  rowSpan,
  title,
  subtitle,
  action,
  badge,
  padding = 'normal',
  interactive = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  onClick,
  id,
}) => {
  const variantStyles: Record<TileVariant, string> = {
    default: 'bg-tile text-ink border border-line',
    mint: 'bg-tileMint text-ink border border-line/60',
    sage: 'bg-tileSage text-ink border border-line/60',
    deep: 'bg-tileDeep text-onDeep border border-tileDeep',
    ink: 'bg-tileInk text-onDeep border border-line/20',
    outlined: 'bg-tile text-ink border-2 border-line',
  };

  const getColClass = (span?: number | string) => {
    if (!span) return '';
    if (typeof span === 'string' && span.startsWith('col-span')) return span;
    const num = Number(span);
    switch (num) {
      case 1: return 'lg:col-span-1';
      case 2: return 'lg:col-span-2 md:col-span-3';
      case 3: return 'lg:col-span-3 md:col-span-3';
      case 4: return 'lg:col-span-4 md:col-span-3';
      case 5: return 'lg:col-span-5 md:col-span-6';
      case 6: return 'lg:col-span-6 md:col-span-6';
      case 7: return 'lg:col-span-7 md:col-span-6';
      case 8: return 'lg:col-span-8 md:col-span-6';
      case 9: return 'lg:col-span-9 md:col-span-6';
      case 10: return 'lg:col-span-10 md:col-span-6';
      case 11: return 'lg:col-span-11 md:col-span-6';
      case 12: return 'col-span-12';
      default: return `lg:col-span-${span}`;
    }
  };

  const getRowClass = (span?: number | string) => {
    if (!span) return '';
    if (typeof span === 'string' && span.startsWith('row-span')) return span;
    const num = Number(span);
    switch (num) {
      case 1: return 'row-span-1';
      case 2: return 'row-span-2';
      case 3: return 'row-span-3';
      case 4: return 'row-span-4';
      case 5: return 'row-span-5';
      case 6: return 'row-span-6';
      case 7: return 'row-span-7';
      default: return `row-span-${span}`;
    }
  };

  const paddingClasses = {
    normal: 'p-5',
    dense: 'p-4',
    none: 'p-0',
  };

  const isDarkVariant = variant === 'deep' || variant === 'ink';

  return (
    <div
      id={id}
      onClick={onClick}
      className={`bento-tile-mount relative rounded-tile overflow-hidden transition-transform duration-150 flex flex-col ${
        interactive ? 'hover:-translate-y-0.5 hover:shadow-hover cursor-pointer' : ''
      } ${variantStyles[variant]} ${getColClass(colSpan)} ${getRowClass(rowSpan)} ${className}`}
    >
      {(title || action || badge) && (
        <div
          className={`flex items-center justify-between gap-3 ${
            padding === 'none' ? 'px-5 pt-4 pb-2' : padding === 'dense' ? 'pb-2' : 'pb-3'
          } ${headerClassName}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {badge}
            <div>
              {typeof title === 'string' ? (
                <h3 className={`font-semibold text-sm tracking-tight truncate ${isDarkVariant ? 'text-onDeep' : 'text-ink'}`}>
                  {title}
                </h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className={`text-xs mt-0.5 ${isDarkVariant ? 'text-onDeep/70' : 'text-ink3'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
        </div>
      )}

      <div className={`flex-1 min-w-0 flex flex-col ${paddingClasses[padding]} ${title || action || badge ? 'pt-0' : ''} ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};
