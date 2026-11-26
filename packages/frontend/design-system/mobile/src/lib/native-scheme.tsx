import { Host } from '@expo/ui';
import { useColorScheme } from 'nativewind';
import { createContext, type PropsWithChildren, useContext } from 'react';
import type { ColorValue } from 'react-native';

export type NativeScheme = 'light' | 'dark';

/** The app's light or dark, as a native control takes it: anything but dark is light. */
export function nativeScheme(colorScheme: string | null | undefined): NativeScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

/** The app's chosen scheme (not the device's), for a native control's appearance prop. */
export function useNativeScheme(): NativeScheme {
  return nativeScheme(useColorScheme().colorScheme);
}

const NativeAccent = createContext<ColorValue | undefined>(undefined);

/**
 * The brand colour every native control is seeded with, set once by
 * `MobileRoot`. Without it Android colours them from the wallpaper (Material
 * You) or Material's default purple, and iOS from the system blue.
 */
export function NativeAccentProvider({
  accent,
  children,
}: PropsWithChildren<{ accent: ColorValue | undefined }>) {
  return <NativeAccent.Provider value={accent}>{children}</NativeAccent.Provider>;
}

export function useNativeAccent(): ColorValue | undefined {
  return useContext(NativeAccent);
}

/**
 * Where an `@expo/ui` control is drawn: sized to the control, in the app's
 * scheme and seeded with its accent. `fillWidth` is for a control as wide as
 * its row (a search bar); every other control is as wide as its content. On Android the seed generates the whole
 * Material 3 Expressive palette; on iOS it is the SwiftUI tint.
 */
export function NativeHost({ fillWidth, children }: PropsWithChildren<{ fillWidth?: boolean }>) {
  return (
    <Host
      matchContents={fillWidth ? { vertical: true } : true}
      colorScheme={useNativeScheme()}
      seedColor={useNativeAccent()}
    >
      {children}
    </Host>
  );
}
