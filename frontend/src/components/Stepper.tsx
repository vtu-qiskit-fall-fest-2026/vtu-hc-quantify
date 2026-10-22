import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStepId: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical' | 'wrap';
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepId,
  onStepClick,
  className = '',
  orientation = 'wrap',
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div
      className={`select-none ${
        orientation === 'vertical'
          ? 'flex flex-col gap-2.5 w-full'
          : orientation === 'horizontal'
          ? 'grid grid-cols-7 gap-1.5 w-full items-center'
          : 'flex flex-wrap items-center gap-2 w-full'
      } ${className}`}
    >
      {steps.map((step, idx) => {
        const isDone = currentIndex > idx;
        const isCurrent = currentIndex === idx;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick && onStepClick(step.id)}
            className={`flex items-center justify-center gap-1.5 ${
              orientation === 'horizontal' ? 'px-1.5 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
            } rounded-pill font-ui transition-all duration-150 text-left ${
              isCurrent
                ? 'bg-green text-white shadow-hairline font-semibold ring-2 ring-green/30 ring-offset-1'
                : isDone
                ? 'bg-greenSoft text-green hover:bg-greenSoft/80 font-medium'
                : 'bg-tile text-ink2 border border-line hover:bg-tileMint/40 font-normal'
            } ${onStepClick ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {/* Numbered Circle */}
            <div
              className={`${
                orientation === 'horizontal' ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[11px]'
              } rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                isCurrent
                  ? 'bg-white text-green font-bold shadow-sm'
                  : isDone
                  ? 'bg-green text-white font-bold'
                  : 'bg-canvas text-ink3 border border-line font-medium'
              }`}
            >
              {isDone ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                idx + 1
              )}
            </div>

            <span className="truncate">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
};
