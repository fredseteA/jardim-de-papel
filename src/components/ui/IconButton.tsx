import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; };
export function IconButton({ label, children, className, type = 'button', ...props }: Props) {
  return <button type={type} aria-label={label} className={cn('inline-flex size-11 items-center justify-center rounded-xl text-forest transition-colors hover:bg-forest/8', className)} {...props}>{children}</button>;
}
