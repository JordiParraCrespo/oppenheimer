import { Play } from 'lucide-react-native';

/**
 * The glyphs a hero action can carry, each once for both platforms: the Lucide
 * icon iOS draws and the Material Symbol (vector XML) Android draws. A new
 * hero action adds its glyph here, not at the call site.
 */
export const HERO_ICONS = {
  play: { lucide: Play, material: require('../../assets/play_arrow.xml') },
} as const;

export type HeroIcon = keyof typeof HERO_ICONS;

export type NativeHeroProps = {
  label: string;
  onPress: () => void;
  /** A request is out: the glyph becomes a loading indicator and presses are ignored. */
  busy?: boolean;
  icon: HeroIcon;
};
