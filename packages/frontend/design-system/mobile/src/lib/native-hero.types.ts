import type { LucideIcon } from 'lucide-react-native';
import type { ImageSourcePropType } from 'react-native';

export type NativeHeroProps = {
  label: string;
  onPress: () => void;
  /** A request is out: the glyph becomes a loading indicator and presses are ignored. */
  busy?: boolean;
  /** The glyph iOS draws (a Lucide icon, as the rest of the app). */
  icon: LucideIcon;
  /** The glyph Android draws: a Material Symbol as a vector drawable (`require('…/name.xml')`). */
  materialIcon: ImageSourcePropType;
};
