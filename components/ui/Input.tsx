'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[var(--ink-2)] uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all',
            error && 'border-[var(--fall)] focus:border-[var(--fall)] focus:ring-[var(--fall)]/10',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--fall)]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
