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
          'inline-flex items-center justify-center font-mono font-medium rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-[#00FF88] text-[#08090C] hover:bg-[#00CC6A] active:scale-95': variant === 'primary',
            'border border-[#1E2130] text-[#8892A4] hover:border-[#00FF88] hover:text-[#00FF88] bg-transparent': variant === 'ghost',
            'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20': variant === 'danger',
            'border border-[#1E2130] text-[#F0F2F5] hover:border-[#00FF88] bg-transparent': variant === 'outline',
          },
          {
            'text-xs px-3 py-1.5': size === 'sm',
            'text-sm px-4 py-2': size === 'md',
            'text-base px-6 py-3': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
