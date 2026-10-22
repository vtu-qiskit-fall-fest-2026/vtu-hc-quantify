import React, { useId } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

interface CircleSealProps {
  label?: string;
  sublabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'certified' | 'fallback' | 'quantum';
}

export const CircleSeal: React.FC<CircleSealProps> = ({
  label = 'CERTIFIED SAFE',
  sublabel = 'ZERO CLASHES',
  className = '',
  size = 'lg',
  status = 'certified',
}) => {
  const pathId = useId();

  // Dimensions: sm: 64px, md: 80px, lg: 96px (Phase 2 spec is 96px)
  const sizeMap = {
    sm: { box: 'w-16 h-16', dim: 64, r: 21, fontSize: '6px', checkSize: 'w-3 h-3', centerCircle: 'w-6 h-6' },
    md: { box: 'w-20 h-20', dim: 80, r: 27, fontSize: '7px', checkSize: 'w-3.5 h-3.5', centerCircle: 'w-7 h-7' },
    lg: { box: 'w-24 h-24', dim: 96, r: 33, fontSize: '8px', checkSize: 'w-4 h-4', centerCircle: 'w-8 h-8' },
  };

  const { box, dim, r, fontSize, checkSize, centerCircle } = sizeMap[size];
  const center = dim / 2;

  const statusBg = {
    certified: 'bg-green text-white border-white',
    fallback: 'bg-warn text-white border-white',
    quantum: 'bg-quantum text-white border-white',
  };

  const displayText = `${label.toUpperCase()} · ${sublabel.toUpperCase()} · `;

  return (
    <div
      className={`rounded-full relative flex items-center justify-center border-4 shadow-hairline select-none flex-shrink-0 ${
        statusBg[status]
      } ${box} ${className}`}
      style={{ width: `${dim}px`, height: `${dim}px` }}
      title={`${label} - ${sublabel}`}
    >
      {/* Rotating SVG circular text path (rotates once per 24s) */}
      <svg
        viewBox={`0 0 ${dim} ${dim}`}
        className="absolute inset-0 w-full h-full animate-spin-slow origin-center pointer-events-none"
      >
        <defs>
          <path
            id={pathId}
            d={`M ${center}, ${center} m -${r}, 0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`}
            fill="none"
          />
        </defs>
        <text
          fill="currentColor"
          style={{ fontSize, fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.12em' }}
        >
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {displayText}
          </textPath>
        </text>
      </svg>

      {/* Stationary Center Icon Container */}
      <div className={`relative z-10 rounded-full bg-white/20 flex items-center justify-center text-white ${centerCircle}`}>
        {status === 'fallback' ? (
          <AlertTriangle className={`${checkSize} stroke-[2.5]`} />
        ) : (
          <Check className={`${checkSize} stroke-[3]`} />
        )}
      </div>
    </div>
  );
};
