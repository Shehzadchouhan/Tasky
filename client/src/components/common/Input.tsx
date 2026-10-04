import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150',
              'bg-white border text-slate-900 placeholder:text-slate-400',
              'dark:bg-[#1e1e2f] dark:text-slate-100 dark:placeholder:text-slate-500',
              error
                ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500/30'
                : 'border-slate-300 dark:border-white/10 focus-visible:border-[#6c63ff] focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30',
              'focus-visible:outline-none',
              className
            )
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-rose-500 font-medium mt-0.5">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
