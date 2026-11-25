import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { Platform, View } from 'react-native';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** A label and its value on one line of a card, the value in the mono face the export gives it. */
export function DetailField({
  label,
  value,
  first,
}: {
  label: string;
  value: string;
  first: boolean;
}) {
  return (
    <View
      className={cn(
        'min-h-12 flex-row items-center gap-3 px-4 py-3',
        !first && 'border-t border-border-subtle',
      )}
    >
      <Text variant="body">{label}</Text>
      <Text
        variant="caption"
        className="flex-1 text-right"
        style={{ fontFamily: MONO }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
