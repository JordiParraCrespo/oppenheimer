import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { Pressable, ScrollView } from 'react-native';

/** The row of filter chips under the search: a label and its count each, one picked. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; count: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {options.map((option) => {
        const picked = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked }}
            onPress={() => onChange(option.value)}
            className={cn(
              'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5',
              picked ? 'border-primary/30 bg-primary/15' : 'border-border-default',
            )}
          >
            <Text variant="body" tone={picked ? 'accent' : 'default'}>
              {option.label}
            </Text>
            <Text variant="caption" tone={picked ? 'accent' : 'muted'}>
              {String(option.count)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
