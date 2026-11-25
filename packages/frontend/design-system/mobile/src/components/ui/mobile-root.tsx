import { PortalProvider } from '@gorhom/portal';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { OverlayProvider } from './overlay';

/**
 * The roots every overlay needs, outermost first: gestures, @gorhom's portal
 * registry, then toasts, then the overlay host painted over the screens.
 * Menus, alerts and sheets are the system's (`@expo/ui`, `Alert`, a
 * `formSheet` route), so none of them needs a host here.
 */
export function MobileRoot({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView className="flex-1">
      <PortalProvider shouldAddRootHost={false}>
        <RootSiblingParent>
          <OverlayProvider>{children}</OverlayProvider>
        </RootSiblingParent>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}
