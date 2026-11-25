import { Picker, Text } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { NativeHost } from './native-scheme';
import type { NativeSegmentedProps } from './native-segmented.types';

/** SwiftUI's segmented picker (`UISegmentedControl`), sized to its segments. */
export function NativeSegmented({
  labels,
  selectedIndex,
  onSelect,
  disabled,
  testID,
}: NativeSegmentedProps) {
  return (
    <NativeHost>
      <Picker
        selection={selectedIndex}
        onSelectionChange={(index) => onSelect(Number(index))}
        modifiers={[pickerStyle('segmented'), ...(disabled ? [disabledModifier()] : [])]}
        label=""
        testID={testID}
      >
        {labels.map((label, index) => (
          <Text key={label} modifiers={[tag(index)]}>
            {label}
          </Text>
        ))}
      </Picker>
    </NativeHost>
  );
}
