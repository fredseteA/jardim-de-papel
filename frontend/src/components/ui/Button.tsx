import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; };
export function Button({ children, className, variant = 'primary', type = 'button', ...props }: Props) {
  const styles = { primary: 'bg-forest text-ivory hover:bg-forest/90', secondary: 'bg-white text-forest ring-1 ring-forest/15 hover:bg-cream', ghost: 'text-forest hover:bg-forest/8' };
  return <button type={type} className={cn('inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)} {...props}>{children}</button>;
}
