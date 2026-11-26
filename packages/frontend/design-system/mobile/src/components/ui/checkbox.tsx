import { Checkbox as NativeCheckbox } from '@expo/ui';
import { nativeLabel } from '../../lib/native-label';
import { NativeHost } from '../../lib/native-scheme';

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
  return (
    <NativeHost>
      <NativeCheckbox
        value={checked}
        onValueChange={onCheckedChange}
        label={label}
        disabled={disabled}
        testID={testID}
        modifiers={nativeLabel(accessibilityLabel)}
      />
    </NativeHost>
  );
}
