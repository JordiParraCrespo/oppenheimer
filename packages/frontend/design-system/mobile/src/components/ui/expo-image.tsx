import { Image, type ImageProps } from 'expo-image';
import { cssInterop } from 'nativewind';

cssInterop(Image, { className: 'style' });

/**
 * House image component. Screens import this rather than `expo-image` so a
 * swap is one file.
 */
export const ExpoImage = Image;
export type ExpoImageProps = ImageProps;
