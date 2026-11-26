import { CircularWavyProgressIndicator } from '@expo/ui/jetpack-compose';
import { size as sizeModifier } from '@expo/ui/jetpack-compose/modifiers';
import type { NativeLoadingProps } from './native-loading.types';
import { NativeHost } from './native-scheme';

const DP = { small: 24, large: 40 } as const;

/** Material 3 Expressive's wavy circular indicator, in the brand blue. */
export function NativeLoading({ size }: NativeLoadingProps) {
  return (
    <NativeHost>
      <CircularWavyProgressIndicator modifiers={[sizeModifier(DP[size], DP[size])]} />
    </NativeHost>
  );
}
