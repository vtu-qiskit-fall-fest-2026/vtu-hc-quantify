import React from 'react';
import { Tile, TileVariant } from './Tile';

interface StatTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  variant?: TileVariant;
  colSpan?: number | string;
  rowSpan?: number | string;
  className?: string;
  onClick?: () => void;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtext,
  icon,
  variant = 'default',
  colSpan = 3,
  rowSpan = 2,
  className = '',
  onClick,
}) => {
  const isDeep = variant === 'deep' || variant === 'ink';

  return (
    <Tile
      variant={variant}
      colSpan={colSpan}
      rowSpan={rowSpan}
      interactive={!!onClick}
      onClick={onClick}
      className={`justify-between ${className}`}
      padding="normal"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-semibold tracking-wider uppercase font-ui ${
            isDeep ? 'text-onDeep/80' : 'text-ink3'
          }`}
        >
          {label}
        </span>
        {icon && (
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDeep
                ? 'bg-white/10 text-onDeep border border-white/20'
                : 'bg-greenSoft text-green border border-green/20'
            }`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div
          className={`font-semibold text-3xl lg:text-4xl tracking-tight font-ui leading-none ${
            isDeep ? 'text-onDeep' : 'text-ink'
          }`}
        >
          {value}
        </div>
        {subtext && (
          <p
            className={`text-xs mt-1.5 font-ui truncate ${
              isDeep ? 'text-onDeep/70' : 'text-ink2'
            }`}
          >
            {subtext}
          </p>
        )}
      </div>
    </Tile>
  );
};
