import { NativeSegmented } from '../../lib/native-segmented';
import type { Option } from './select';

export type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * One of two to four short, mutually exclusive views, side by side, as the
 * platform draws them: `UISegmentedControl` on iOS (Liquid Glass on iOS 26),
 * Material 3's segmented buttons on Android. It is as wide as its segments,
 * like the other native controls, so a caller places it and never sizes it.
 * More options, or long labels, are a `Select`.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  disabled,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <NativeSegmented
      labels={options.map((option) => option.label)}
      selectedIndex={options.findIndex((option) => option.value === value)}
      onSelect={(index) => {
        const picked = options[index];
        if (picked) onValueChange(picked.value);
      }}
      disabled={disabled}
      testID={testID}
    />
  );
}
