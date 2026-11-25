import {
  ExtendedFloatingActionButton,
  Icon,
  LoadingIndicator,
  Text,
} from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import type { NativeHeroProps } from './native-hero.types';
import { NativeHost } from './native-scheme';

/**
 * Material 3 Expressive's extended FAB: the screen's one primary action,
 * standing apart from the content in the brand's primary container.
 */
export function NativeHero({ label, onPress, busy, materialIcon }: NativeHeroProps) {
  return (
    <NativeHost>
      <ExtendedFloatingActionButton expanded onClick={busy ? undefined : onPress}>
        <ExtendedFloatingActionButton.Icon>
          {busy ? (
            <LoadingIndicator modifiers={[size(24, 24)]} />
          ) : (
            <Icon source={materialIcon} size={24} />
          )}
        </ExtendedFloatingActionButton.Icon>
        <ExtendedFloatingActionButton.Text>
          <Text>{label}</Text>
        </ExtendedFloatingActionButton.Text>
      </ExtendedFloatingActionButton>
    </NativeHost>
  );
}
