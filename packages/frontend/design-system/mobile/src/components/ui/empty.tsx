import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text, TextClassContext } from './text';

function Empty({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        'min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-lg border-dashed p-6',
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View className={cn('max-w-sm flex-col items-center gap-0', className)} {...props} />
  );
}

const emptyMediaVariants = cva('mb-5 shrink-0 items-center justify-center', {
  variants: {
    variant: {
      default: 'bg-transparent',
      icon: 'size-[52px] rounded-full border border-border-subtle bg-surface-sunken',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/**
 * The glyph above the title. `variant="icon"` draws the 52px tile; its
 * children inherit `text-ink-400` through `TextClassContext`, so an `Icon`
 * inside needs no colour of its own.
 */
function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof View> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <TextClassContext.Provider value={variant === 'icon' ? 'text-ink-400' : undefined}>
      <View className={cn(emptyMediaVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text className={cn('text-center text-lg font-medium text-ink-900', className)} {...props} />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('mt-1.5 text-center text-sm text-ink-400', className)} {...props} />;
}

function EmptyContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('mt-5 w-full min-w-0 max-w-sm flex-col items-center gap-4', className)}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
