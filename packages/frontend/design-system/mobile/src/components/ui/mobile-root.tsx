import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalProvider } from '@gorhom/portal';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { OverlayProvider } from './overlay';

/**
 * Overlay stacking order, outermost first: gesture → portal → overlay host →
 * toasts → sheets → screens. `BottomSheetModalProvider` brings a portal
 * registry of its own for the sheets; dialogs and menus use the outer one.
 */
export function MobileRoot({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView className="flex-1">
      <PortalProvider shouldAddRootHost={false}>
        <OverlayProvider>
          <RootSiblingParent>
            <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
          </RootSiblingParent>
        </OverlayProvider>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}
