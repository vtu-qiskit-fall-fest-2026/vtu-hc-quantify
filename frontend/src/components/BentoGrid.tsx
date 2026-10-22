import React from 'react';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  autoRows?: boolean;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  children,
  className = '',
  autoRows = true,
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3 max-w-[1440px] mx-auto w-full ${
        autoRows ? 'auto-rows-[minmax(88px,auto)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
