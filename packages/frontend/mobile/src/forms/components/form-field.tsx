import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Label + control + validation message, mirroring `Field`/`FieldError` from
 * the web design system. Pass `nativeID` through to the control's
 * `aria-labelledby` so screen readers pair the two.
 */
export function FormField({
  label,
  nativeID,
  error,
  accessory,
  children,
}: {
  label: string;
  nativeID: string;
  error?: string;
  /** What sits at the end of the label's line, such as "Forgot password?". */
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Label nativeID={nativeID}>{label}</Label>
        {accessory}
      </View>
      {children}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
