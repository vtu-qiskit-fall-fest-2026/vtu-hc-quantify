export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentOption<T>[] | T[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedProps<T>) {
  const normalizedOptions: SegmentOption<T>[] = options.map((opt) =>
    typeof opt === 'object' && opt !== null && 'value' in opt
      ? (opt as SegmentOption<T>)
      : { value: opt as T, label: String(opt) }
  );

  const heightClass = size === 'sm' ? 'h-6 text-xs' : 'h-7 text-xs';

  return (
    <div
      className={`inline-flex items-center p-0.5 border border-line bg-panel-2 rounded-[2px] ${className}`}
      role="radiogroup"
    >
      {normalizedOptions.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={opt.disabled}
            title={opt.tooltip}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`px-2.5 ${heightClass} font-medium flex items-center justify-center transition-colors rounded-[1px] ${
              isSelected
                ? 'bg-panel text-text border border-line shadow-none font-semibold'
                : opt.disabled
                ? 'text-text-3 opacity-40 cursor-not-allowed'
                : 'text-text-2 hover:text-text hover:bg-panel/50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
