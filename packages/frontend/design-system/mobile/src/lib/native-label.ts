import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { accessibilityLabel, type ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

/**
 * What VoiceOver or TalkBack reads for a native control drawn without a
 * visible label, as each platform's own modifier: SwiftUI's
 * `accessibilityLabel`, Compose's `contentDescription`.
 */
export function nativeLabel(label: string | undefined): ModifierConfig[] {
  if (!label) return [];
  return [
    Platform.OS === 'ios' ? accessibilityLabel(label) : semantics({ contentDescription: label }),
  ];
}
