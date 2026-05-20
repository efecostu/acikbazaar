import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide', className)}
      style={color ? { backgroundColor: `${color}15`, color, border: `1px solid ${color}25` } : undefined}
    >
      {children}
    </span>
  );
}
