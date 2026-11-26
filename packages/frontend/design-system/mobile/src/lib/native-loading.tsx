import { ActivityIndicator } from 'react-native';
import type { NativeLoadingProps } from './native-loading.types';

/** The system spinner (`UIActivityIndicatorView` on iOS). Metro picks `.android` there. */
export function NativeLoading({ size }: NativeLoadingProps) {
  return <ActivityIndicator size={size} />;
}
