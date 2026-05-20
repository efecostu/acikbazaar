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
            'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] bg-transparent': variant === 'ghost',
            'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100': variant === 'danger',
            'border border-[#E5E7EB] text-[#111827] hover:border-[#D1D5DB] hover:bg-[#F9FAFB] bg-white': variant === 'outline',
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
