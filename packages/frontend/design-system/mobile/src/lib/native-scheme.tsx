import { Host } from '@expo/ui';
import { useColorScheme } from 'nativewind';
import type { PropsWithChildren } from 'react';

export type NativeScheme = 'light' | 'dark';

/** The app's light or dark, as a native control takes it: anything but dark is light. */
export function nativeScheme(colorScheme: string | null | undefined): NativeScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

/** The app's chosen scheme (not the device's), for a native control's appearance prop. */
export function useNativeScheme(): NativeScheme {
  return nativeScheme(useColorScheme().colorScheme);
}

/**
 * Where an `@expo/ui` control is drawn: sized to the control, in the app's
 * scheme, so a native control follows the app's light or dark choice.
 */
export function NativeHost({ children }: PropsWithChildren) {
  return (
    <Host matchContents colorScheme={useNativeScheme()}>
      {children}
    </Host>
  );
}
