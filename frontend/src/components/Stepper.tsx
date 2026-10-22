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
    <div className={`flex items-center w-full select-none ${className}`}>
      {steps.map((step, idx) => {
        const isDone = currentIndex > idx;
        const isCurrent = currentIndex === idx;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-5 h-5 rounded-[1px] flex items-center justify-center font-mono text-[11px] font-semibold transition-colors border ${
                  isDone
                    ? 'bg-ok/10 border-ok text-ok'
                    : isCurrent
                    ? 'bg-accent/20 border-accent text-accent animate-pulse'
                    : 'bg-panel-2 border-line text-text-3'
                }`}
              >
                {isDone ? <Check className="w-3 h-3 stroke-[2.5]" /> : idx + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent
                    ? 'text-accent font-semibold'
                    : isDone
                    ? 'text-text'
                    : 'text-text-3'
                }`}
              >
                {step.label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-[1px] mx-2 transition-colors ${
                  isDone ? 'bg-ok/50' : 'bg-line'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
