import { LoadingIndicator } from '@expo/ui/jetpack-compose';
import { size as sizeModifier } from '@expo/ui/jetpack-compose/modifiers';
import type { NativeLoadingProps } from './native-loading.types';
import { NativeHost } from './native-scheme';

const DP = { small: 28, large: 48 } as const;

/** Material 3 Expressive's loading indicator: the shape that morphs while it waits. */
export function NativeLoading({ size }: NativeLoadingProps) {
  return (
    <NativeHost>
      <LoadingIndicator modifiers={[sizeModifier(DP[size], DP[size])]} />
    </NativeHost>
  );
}
