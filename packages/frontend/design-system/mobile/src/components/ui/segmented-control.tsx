import { SegmentedControl as NativeSegmentedControl } from '@expo/ui/community/segmented-control';
import { useColorScheme } from 'nativewind';
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
 * Material 3's segmented buttons on Android. More options, or long labels,
 * are a `Select`.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  disabled,
  testID,
}: SegmentedControlProps<T>) {
  const { colorScheme } = useColorScheme();

  return (
    <NativeSegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={options.findIndex((option) => option.value === value)}
      onChange={({ nativeEvent }) => {
        const picked = options[nativeEvent.selectedSegmentIndex];
        if (picked) onValueChange(picked.value);
      }}
      enabled={!disabled}
      appearance={colorScheme === 'dark' ? 'dark' : 'light'}
      testID={testID}
    />
  );
}
