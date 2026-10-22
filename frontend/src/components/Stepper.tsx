import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStepId: string;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepId,
  className = '',
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={`flex items-center gap-1.5 w-full select-none overflow-x-auto py-1 ${className}`}>
      {steps.map((step, idx) => {
        const isDone = currentIndex > idx;
        const isCurrent = currentIndex === idx;

        return (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill font-ui text-xs transition-all duration-200 flex-shrink-0 ${
                isDone
                  ? 'bg-greenSoft text-green border border-green/30 font-medium'
                  : isCurrent
                  ? 'bg-green text-white shadow-hairline border border-green font-semibold'
                  : 'bg-line/30 text-ink3 border border-line/50 font-normal'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  isDone
                    ? 'bg-green text-white'
                    : isCurrent
                    ? 'bg-white text-green'
                    : 'bg-ink3/20 text-ink3'
                }`}
              >
                {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
              </div>
              <span className="truncate">{step.label}</span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`h-[1.5px] flex-1 min-w-[8px] transition-colors ${
                  isDone ? 'bg-green/50' : 'bg-line/70'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
