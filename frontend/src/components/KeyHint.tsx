import React from 'react';

interface KeyHintProps {
  onOpenShortcuts?: () => void;
  className?: string;
}

export const KeyHintBar: React.FC<KeyHintProps> = ({
  onOpenShortcuts,
  className = '',
}) => {
  return (
    <footer
      className={`h-7 px-3 border-t border-line bg-panel-2 flex items-center justify-between text-[11px] text-text-3 font-mono select-none z-30 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            g d
          </kbd>
          <span>Dataset</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            g t
          </kbd>
          <span>Timetable</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            g c
          </kbd>
          <span>Cluster Lab</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            g b
          </kbd>
          <span>Benchmarks</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            r
          </kbd>
          <span>Run</span>
        </span>
      </div>
      <div>
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="flex items-center gap-1 hover:text-text cursor-pointer"
        >
          <kbd className="px-1 py-0.2 border border-line bg-panel text-text-2 rounded-[2px]">
            ?
          </kbd>
          <span>Shortcuts</span>
        </button>
      </div>
    </footer>
  );
};
