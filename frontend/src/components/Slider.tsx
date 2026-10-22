import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  onReset?: () => void;
  defaultValue?: number;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  onReset,
  defaultValue,
  className = '',
}) => {
  const isChanged = defaultValue !== undefined && value !== defaultValue;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-2 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {isChanged && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] text-text-3 hover:text-accent underline cursor-pointer"
            >
              reset
            </button>
          )}
          <span className="font-mono text-text tabular-nums font-medium">
            {value}
            {unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-line rounded-[1px] appearance-none cursor-pointer accent-accent focus:outline-none"
      />
    </div>
  );
};
