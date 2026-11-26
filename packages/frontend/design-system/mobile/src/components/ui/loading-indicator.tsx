import { View } from 'react-native';
import { NativeLoading } from '../../lib/native-loading';

export type LoadingIndicatorProps = {
  size?: 'small' | 'large';
  /** What a screen reader says while it shows. */
  accessibilityLabel?: string;
};

/**
 * Something is on its way, as the platform shows it: Material 3 Expressive's
 * wavy circular indicator on Android, the system spinner on iOS. For a wait
 * with no known length; a known one is `Progress`.
 */
export function LoadingIndicator({ size = 'small', accessibilityLabel }: LoadingIndicatorProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <NativeLoading size={size} />
    </View>
  );
}
