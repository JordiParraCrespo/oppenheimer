import { Host, Picker } from '@expo/ui';
import { useColorScheme } from 'nativewind';

export type Option<T extends string | number = string> = { label: string; value: T };

export type SelectProps<T extends string | number> = {
  value: T;
  options: readonly Option<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * A choice among a few options, as the platform draws it: on iOS a SwiftUI
 * menu picker, which iOS 26 renders in Liquid Glass; on Android Material's
 * dropdown. Nothing here draws the menu, so it is always the system's own —
 * its motion, its haptics, its accessibility.
 */
export function Select<T extends string | number>({
  value,
  options,
  onValueChange,
  disabled,
  testID,
}: SelectProps<T>) {
  const { colorScheme } = useColorScheme();

  return (
    <Host matchContents colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        appearance="menu"
        enabled={!disabled}
        testID={testID}
      >
        {options.map((option) => (
          <Picker.Item key={String(option.value)} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Host>
  );
}
