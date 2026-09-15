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
  children,
}: {
  label: string;
  nativeID: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Label nativeID={nativeID}>{label}</Label>
      {children}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
