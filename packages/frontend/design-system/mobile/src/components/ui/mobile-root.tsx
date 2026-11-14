import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalProvider } from '@gorhom/portal';
import { PortalHost } from '@rn-primitives/portal';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { OverlayProvider } from './overlay';

/**
 * The roots every overlay needs, outermost first: gestures, @gorhom's portal
 * registry, toasts, and the bottom sheets, which bring a portal registry of
 * their own. Inside that sit the screens and, painted over them, the two
 * hosts: rn-primitives' (dialogs, selects, popovers, menus) and the overlay
 * host. A `<Portal>` only reaches hosts in its own registry, which is why the
 * overlay host is inside the sheets' provider rather than beside it.
 */
export function MobileRoot({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView className="flex-1">
      <PortalProvider shouldAddRootHost={false}>
        <RootSiblingParent>
          <BottomSheetModalProvider>
            <OverlayProvider>
              {children}
              {/* Where the rn-primitives dialogs, selects, popovers and menus
                  draw: a registry of its own, apart from @gorhom's. */}
              <PortalHost />
            </OverlayProvider>
          </BottomSheetModalProvider>
        </RootSiblingParent>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}
