import React from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAppStore, ToastMessage } from '../store';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  const iconMap = {
    info: <Info className="w-4 h-4 text-accent flex-shrink-0" />,
    ok: <CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0" />,
    warn: <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />,
  };

  const borderMap = {
    info: 'border-l-4 border-l-accent',
    ok: 'border-l-4 border-l-ok',
    warn: 'border-l-4 border-l-warn',
    error: 'border-l-4 border-l-bad',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 p-3 bg-panel border border-line ${borderMap[toast.type]} rounded-[2px] shadow-none`}
    >
      <div className="mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 text-xs text-text leading-tight break-words font-medium">
        {toast.message}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-text-3 hover:text-text p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
