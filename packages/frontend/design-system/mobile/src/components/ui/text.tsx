import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';
import { cn } from '../../lib/utils';

const textVariants = cva(
  cn(
    'text-foreground text-base tracking-[-0.15px]',
    Platform.select({
      web: 'select-text',
    }),
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-2xl font-medium',
          Platform.select({ web: 'scroll-m-20 text-balance' }),
        ),
        h2: cn(
          'border-border-subtle border-b pb-2 text-2xl font-medium',
          Platform.select({ web: 'scroll-m-20 first:mt-0' }),
        ),
        h3: cn('text-xl font-medium', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-lg font-medium', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-6 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium',
        ),
        lead: 'text-muted-foreground text-lg',
        large: 'text-lg font-medium',
        small: 'text-sm font-medium leading-none',
        muted: 'text-muted-foreground text-sm',
        // The export's iOS ramp: a section's large title, the 15px list and
        // body text under it, 13px secondary lines, 11px group labels.
        largeTitle: 'text-[34px] font-semibold leading-[40px] tracking-[-0.75px]',
        body: 'text-[15px] tracking-[-0.15px]',
        subhead: 'text-muted-foreground text-[15px]',
        caption: 'text-muted-foreground text-[13px]',
        overline: 'text-muted-foreground text-[11px] uppercase tracking-[0.2px]',
      },
      tone: {
        default: '',
        muted: 'text-muted-foreground',
        accent: 'text-primary',
        destructive: 'text-destructive',
        // Over a photograph or the primary fill, in either theme.
        inverse: 'text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
      tone: 'default',
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  largeTitle: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  largeTitle: '1',
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  tone,
  ...props
}: React.ComponentProps<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component
      className={cn(textVariants({ variant, tone }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
