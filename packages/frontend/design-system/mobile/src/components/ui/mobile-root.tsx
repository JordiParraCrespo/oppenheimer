import { PortalProvider } from '@gorhom/portal';
import type { PropsWithChildren } from 'react';
import type { ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { NativeAccentProvider } from '../../lib/native-scheme';
import { OverlayProvider } from './overlay';

/**
 * The roots every overlay needs, outermost first: gestures, @gorhom's portal
 * registry, then toasts, then the overlay host painted over the screens.
 * Menus, alerts and sheets are the system's (`@expo/ui`, `Alert`, a
 * `formSheet` route), so none of them needs a host here. `accent` seeds
 * every native control with the brand colour.
 */
export function MobileRoot({ accent, children }: PropsWithChildren<{ accent?: ColorValue }>) {
  return (
    <GestureHandlerRootView className="flex-1">
      <PortalProvider shouldAddRootHost={false}>
        <RootSiblingParent>
          <NativeAccentProvider accent={accent}>
            <OverlayProvider>{children}</OverlayProvider>
          </NativeAccentProvider>
        </RootSiblingParent>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}
