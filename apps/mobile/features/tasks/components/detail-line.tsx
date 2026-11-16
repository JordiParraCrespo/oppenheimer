import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/** A label and its value on one line of a card; the value is text, or a control (`children`). */
export function DetailLine({
  label,
  value,
  tone,
  first,
  children,
}: {
  label: string;
  value?: string;
  tone?: 'destructive';
  first: boolean;
  children?: ReactNode;
}) {
  return (
    <View
      className={cn(
        'min-h-12 flex-row items-center gap-3 px-4 py-2',
        !first && 'border-t border-border-subtle',
      )}
    >
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      {children ?? (
        <Text variant="caption" tone={tone} numberOfLines={1} className="max-w-[60%] text-right">
          {value}
        </Text>
      )}
    </View>
  );
}
