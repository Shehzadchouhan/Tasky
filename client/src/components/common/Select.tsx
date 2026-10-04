import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, id, className, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        <label
          htmlFor={selectId}
          className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150',
              'bg-white border text-slate-900',
              'dark:bg-[#1e1e2f] dark:text-slate-100',
              error
                ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500/30'
                : 'border-slate-300 dark:border-white/10 focus-visible:border-[#6c63ff] focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30',
              'focus-visible:outline-none',
              className
            )
          )}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-white text-slate-900 dark:bg-[#1e1e2f] dark:text-slate-100"
            >
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-xs text-rose-500 font-medium mt-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
