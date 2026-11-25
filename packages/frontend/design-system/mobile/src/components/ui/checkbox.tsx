import { Host, Checkbox as NativeCheckbox } from '@expo/ui';
import { useColorScheme } from 'nativewind';
import { nativeLabel } from '../../lib/native-label';

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** What a screen reader calls the control when no label is drawn. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * A yes/no choice in a form, as the platform draws it: Material 3's checkbox
 * on Android, and on iOS, which has no checkbox, SwiftUI's toggle, the control
 * Apple's guidance gives a binary setting there.
 */
export function Checkbox({ checked, onCheckedChange, label, disabled, accessibilityLabel, testID }: CheckboxProps) {
  const { colorScheme } = useColorScheme();

  return (
    <Host matchContents colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
      <NativeCheckbox
        value={checked}
        onValueChange={onCheckedChange}
        label={label}
        disabled={disabled}
        testID={testID}
        modifiers={nativeLabel(accessibilityLabel)}
      />
    </Host>
  );
}
