import { Portal, PortalHost, PortalProvider } from '@gorhom/portal';
import { memo, useEffect, useState } from 'react';
import { useWindowDimensions, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';
import { useHardwareBack } from '../../hooks/use-hardware-back';

export const OVERLAY_PORTAL_NAME = 'overlay';
const EXIT_DURATION = 280;

export type OverlayAnimation = 'fade' | 'slide-bottom';

export type OverlayProps = ViewProps & {
  open?: boolean;
  animation?: OverlayAnimation;
  preload?: boolean;
  className?: string;
  onClose?: () => void;
};

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PortalHost name={OVERLAY_PORTAL_NAME} />
    </>
  );
}

export function Overlay({ preload = false, onClose, ...props }: OverlayProps) {
  const [isMounted, setIsMounted] = useState(props.open ?? true);

  useHardwareBack(Boolean(props.open && onClose), () => onClose?.());

  useEffect(() => {
    if (props.open ?? true) {
      setIsMounted(true);
      return;
    }
    const timer = setTimeout(() => setIsMounted(false), EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [props.open]);

  if (!preload && !isMounted) return null;

  return (
    <Portal hostName={OVERLAY_PORTAL_NAME}>
      <InternalOverlay {...props} />
    </Portal>
  );
}

const InternalOverlay = memo(function InternalOverlay({
  open = true,
  animation = 'fade',
  className,
  style,
  children,
  ...rest
}: OverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setIsVisible(open);
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => {
    const pointerEvents = isVisible ? ('auto' as const) : ('none' as const);

    if (animation === 'slide-bottom' && !reduceMotion) {
      return {
        pointerEvents,
        transform: [
          {
            translateY: isVisible
              ? withSpring(0, { damping: 30, stiffness: 300 })
              : withTiming(height, { duration: EXIT_DURATION }),
          },
        ],
      };
    }

    return { pointerEvents, opacity: withTiming(isVisible ? 1 : 0, { duration: EXIT_DURATION }) };
  });

  return (
    <Animated.View
      className={cn('absolute inset-0', animation === 'fade' && 'opacity-0', className)}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
});

export { PortalProvider };
