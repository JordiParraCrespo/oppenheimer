import { SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';
import { NativeHost } from './native-scheme';
import type { NativeSegmentedProps } from './native-segmented.types';

/** Material 3's single-choice segmented buttons, sized to their segments. */
export function NativeSegmented({
  labels,
  selectedIndex,
  onSelect,
  disabled,
}: NativeSegmentedProps) {
  return (
    <NativeHost>
      <SingleChoiceSegmentedButtonRow>
        {labels.map((label, index) => (
          <SegmentedButton
            key={label}
            selected={index === selectedIndex}
            onClick={() => onSelect(index)}
            enabled={!disabled}
          >
            <SegmentedButton.Label>
              <Text>{label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </NativeHost>
  );
}
