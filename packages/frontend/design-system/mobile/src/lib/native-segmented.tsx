import { SegmentedControl } from '@expo/ui/community/segmented-control';
import type { NativeSegmentedProps } from './native-segmented.types';

/**
 * Where neither SwiftUI nor Compose draws (web, tests): `@expo/ui`'s own
 * fallback. Metro picks `.ios` or `.android` on a phone.
 */
export function NativeSegmented({
  labels,
  selectedIndex,
  onSelect,
  disabled,
  testID,
}: NativeSegmentedProps) {
  return (
    <SegmentedControl
      values={[...labels]}
      selectedIndex={selectedIndex}
      onChange={({ nativeEvent }) => onSelect(nativeEvent.selectedSegmentIndex)}
      enabled={!disabled}
      testID={testID}
    />
  );
}
