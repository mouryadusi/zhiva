import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

// Exposed so navigational elements (e.g. <Link>) can look like a button
// without nesting a real <button> inside an <a> — nesting interactive
// elements is invalid HTML and breaks keyboard/screen-reader behavior.
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  return clsx(
    'motion-safe-transition inline-flex items-center justify-center gap-2 rounded-full font-medium',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
    {
      'bg-accent text-accent-ink hover:opacity-90': variant === 'primary',
      'border border-border bg-surface-raised text-ink hover:border-accent/50': variant === 'secondary',
      'text-ink hover:bg-surface-sunken': variant === 'ghost',
    },
    {
      'px-4 py-2 text-sm': size === 'sm',
      'px-6 py-3 text-base': size === 'md',
      'px-8 py-4 text-lg': size === 'lg',
    },
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return <button ref={ref} className={buttonClasses({ variant, size, className })} {...props} />;
  }
);
Button.displayName = 'Button';
