import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal as LibraryBottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { cssInterop } from 'nativewind';
import { type ComponentPropsWithRef, type ComponentType, useCallback, useEffect, useRef } from 'react';
import type { ViewProps } from 'react-native';
import { useHardwareBack } from '../../hooks/use-hardware-back';
import { cn } from '../../lib/utils';

cssInterop(LibraryBottomSheetModal, {
  className: 'style',
  backgroundClassName: 'backgroundStyle',
  handleIndicatorClassName: 'handleIndicatorStyle',
});

const StyledBottomSheetModal = LibraryBottomSheetModal as ComponentType<
  ComponentPropsWithRef<typeof LibraryBottomSheetModal> & {
    backgroundClassName?: string;
    handleIndicatorClassName?: string;
  }
>;
cssInterop(BottomSheetView, { className: 'style' });
cssInterop(BottomSheetScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export type BottomSheetModalProps = {
  open: boolean;
  onClose?: () => void;
  closable?: boolean;
  snapPoints?: Array<string | number>;
  enableDynamicSizing?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function BottomSheetModal({
  open,
  onClose,
  closable = true,
  snapPoints,
  enableDynamicSizing = true,
  children,
  className,
}: BottomSheetModalProps) {
  const ref = useRef<LibraryBottomSheetModal<unknown>>(null);

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  useHardwareBack(open, () => {
    if (closable) ref.current?.dismiss();
  });

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={closable ? 'close' : 'none'}
      />
    ),
    [closable],
  );

  return (
    <StyledBottomSheetModal
      ref={ref}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={closable}
      enableOverDrag={closable}
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={snapPoints}
      backgroundClassName={cn('bg-card rounded-t-lg', className)}
      handleIndicatorClassName="bg-border w-9"
      keyboardBlurBehavior="restore"
    >
      {children}
    </StyledBottomSheetModal>
  );
}

export function BottomSheetModalContent({ className, children, style }: ViewProps) {
  return (
    <BottomSheetView className={cn('px-5 pb-8 pt-2', className)} style={style}>
      {children}
    </BottomSheetView>
  );
}

export { BottomSheetModalProvider, BottomSheetScrollView };
