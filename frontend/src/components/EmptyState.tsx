import React from 'react';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`border border-line border-dashed bg-panel-2/50 rounded-[2px] p-6 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      <p className="text-xs text-text-2 font-mono max-w-md">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-3 py-1.5 border border-line bg-panel hover:bg-panel-2 text-text text-xs font-medium rounded-[2px] transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
