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
            'bg-[#16A34A] text-white hover:bg-[#15803D] active:scale-[0.98]': variant === 'primary',
            'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] hover:bg-[#F3F4F6] dark:hover:bg-[#1E293B] bg-transparent': variant === 'ghost',
            'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50': variant === 'danger',
            'border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-[#F1F5F9] hover:border-[#D1D5DB] dark:hover:border-[#475569] hover:bg-[#F9FAFB] dark:hover:bg-[#1E293B] bg-white dark:bg-[#1E293B]': variant === 'outline',
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
