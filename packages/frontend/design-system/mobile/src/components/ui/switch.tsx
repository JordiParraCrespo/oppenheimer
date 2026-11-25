import { Switch as NativeSwitch } from '@expo/ui';
import { nativeLabel } from '../../lib/native-label';
import { NativeHost } from '../../lib/native-scheme';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** What a screen reader calls the control when no label is drawn. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * An on/off setting, as the platform draws it: SwiftUI's toggle (`UISwitch`)
 * on iOS, Material 3's switch on Android. The track, the thumb, the motion and
 * the haptic tick are the system's; nothing here paints them.
 */
export function Switch({ checked, onCheckedChange, disabled, accessibilityLabel, testID }: SwitchProps) {
  return (
    <NativeHost>
      <NativeSwitch
        value={checked}
        onValueChange={onCheckedChange}
        disabled={disabled}
        testID={testID}
        modifiers={nativeLabel(accessibilityLabel)}
      />
    </NativeHost>
  );
}
