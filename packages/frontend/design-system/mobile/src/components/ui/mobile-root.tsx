import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalProvider } from '@gorhom/portal';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { OverlayProvider } from './overlay';

/**
 * Overlay stacking order, outermost first: gesture → portal → toasts →
 * sheets → overlay host → screens. `BottomSheetModalProvider` brings a portal
 * registry of its own, and a `<Portal>` inside it reaches only hosts inside
 * it, so the overlay host sits within it too.
 */
export function MobileRoot({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView className="flex-1">
      <PortalProvider shouldAddRootHost={false}>
        <RootSiblingParent>
          <BottomSheetModalProvider>
            <OverlayProvider>{children}</OverlayProvider>
          </BottomSheetModalProvider>
        </RootSiblingParent>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}
