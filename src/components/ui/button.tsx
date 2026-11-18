import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';
const styles = cva('button', {
  variants: {
    variant: {
      default: 'button-primary',
      outline: 'button-outline',
      soft: 'button-soft',
      danger: 'button-danger',
    },
  },
  defaultVariants: { variant: 'default' },
});
export function Button({
  asChild = false,
  variant,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof styles> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={twMerge(clsx(styles({ variant }), className))} {...props} />;
}
