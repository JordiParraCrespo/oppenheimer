import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { Platform, Pressable, ScrollView } from 'react-native';
import { TERMINAL_KEYS, type TerminalKey } from '../lib/terminal-keys';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The keys a phone keyboard lacks, in a row that scrolls sideways: escape,
 * tab, ctrl (lit while it holds), interrupt and the arrows.
 */
export function KeyRow({
  ctrl,
  onKey,
  label,
}: {
  ctrl: boolean;
  onKey: (key: TerminalKey) => void;
  label: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-3"
      keyboardShouldPersistTaps="always"
      accessibilityLabel={label}
    >
      {TERMINAL_KEYS.map((key) => {
        const held = key.id === 'ctrl' && ctrl;
        return (
          <Pressable
            key={key.id}
            onPress={() => onKey(key)}
            accessibilityRole="button"
            accessibilityState={key.id === 'ctrl' ? { selected: held } : undefined}
            className={cn(
              'h-9 min-w-12 items-center justify-center rounded-full px-3 active:opacity-70',
              held ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <Text
              variant="caption"
              tone={held ? 'inverse' : 'default'}
              style={{ fontFamily: MONO }}
            >
              {key.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
