import {
  CircularWavyProgressIndicator,
  ExtendedFloatingActionButton,
  Icon,
  Text,
} from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { HERO_ICONS, type NativeHeroProps } from './native-hero.types';
import { NativeHost } from './native-scheme';

/**
 * Material 3 Expressive's extended FAB: the screen's one primary action,
 * standing apart from the content in the brand's primary container.
 */
export function NativeHero({ label, onPress, busy, icon }: NativeHeroProps) {
  return (
    <NativeHost>
      <ExtendedFloatingActionButton expanded onClick={busy ? undefined : onPress}>
        <ExtendedFloatingActionButton.Icon>
          {busy ? (
            <CircularWavyProgressIndicator modifiers={[size(24, 24)]} />
          ) : (
            <Icon source={HERO_ICONS[icon].material} size={24} />
          )}
        </ExtendedFloatingActionButton.Icon>
        <ExtendedFloatingActionButton.Text>
          <Text>{label}</Text>
        </ExtendedFloatingActionButton.Text>
      </ExtendedFloatingActionButton>
    </NativeHost>
  );
}
