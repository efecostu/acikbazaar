'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
          {
            'bg-[var(--rise)] text-white hover:brightness-110 active:scale-[0.98]': variant === 'primary',
            'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] bg-transparent': variant === 'ghost',
            'bg-[var(--fall-soft)] text-[var(--fall)] border border-[var(--fall-line)] hover:brightness-95': variant === 'danger',
            'border border-[var(--border)] text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--surface-2)] bg-[var(--surface)]': variant === 'outline',
          },
          {
            'text-xs px-3 py-1.5': size === 'sm',
            'text-sm px-4 py-2': size === 'md',
            'text-sm px-5 py-2.5': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
