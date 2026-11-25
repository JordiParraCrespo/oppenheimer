import { NativeHero } from '../../lib/native-hero';
import type { NativeHeroProps } from '../../lib/native-hero.types';

export type HeroActionProps = NativeHeroProps;

/**
 * A screen's one primary action, floating over its content: Material 3
 * Expressive's extended FAB on Android, a primary pill in Liquid Glass on iOS.
 * Keep it to the action that is the point of the screen; a screen has at most
 * one, and the app only a few.
 */
export function HeroAction(props: HeroActionProps) {
  return <NativeHero {...props} />;
}
