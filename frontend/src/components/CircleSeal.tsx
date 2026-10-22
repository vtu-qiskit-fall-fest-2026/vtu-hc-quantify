import React from 'react';
import { Check } from 'lucide-react';

interface CircleSealProps {
  label?: string;
  sublabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'certified' | 'fallback' | 'quantum';
}

export const CircleSeal: React.FC<CircleSealProps> = ({
  label = '0 VIOLATIONS',
  sublabel = 'CERTIFIED',
  className = '',
  size = 'md',
  status = 'certified',
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16 text-[9px]',
    md: 'w-20 h-20 text-[10px]',
    lg: 'w-24 h-24 text-[11px]',
  };

  const statusBg = {
    certified: 'bg-green text-white shadow-hover border-4 border-white',
    fallback: 'bg-warn text-white shadow-hover border-4 border-white',
    quantum: 'bg-quantum text-white shadow-hover border-4 border-white',
  };

  return (
    <div
      className={`rounded-full flex flex-col items-center justify-center font-ui font-semibold text-center select-none z-10 ${
        statusBg[status]
      } ${sizeClasses[size]} ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      </div>
      <span className="leading-tight tracking-wider uppercase">{label}</span>
      <span className="text-[8px] opacity-85 tracking-widest uppercase">{sublabel}</span>
    </div>
  );
};
