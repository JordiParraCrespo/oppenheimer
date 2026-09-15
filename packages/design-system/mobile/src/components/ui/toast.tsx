import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeOutUp,
  SlideInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import RootSiblings from 'react-native-root-siblings';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Info } from 'lucide-react-native';

const DEFAULT_DURATION = 3200;
const EXIT_DURATION = 220;
const SETTLE_SPRING = { damping: 26, stiffness: 320 };

export type ToastVariant = 'default' | 'destructive';

export type ShowToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

export function toast({ title, description, variant = 'default', duration }: ShowToastProps): void {
  const sibling: RootSiblings = new RootSiblings(
    (
      <Toast variant={variant} duration={duration} onDestroy={() => sibling.destroy()}>
        <AlertTitle>{title}</AlertTitle>
        {description !== undefined ? <AlertDescription>{description}</AlertDescription> : null}
      </Toast>
    ),
  );
}

type ToastProps = {
  variant?: ToastVariant;
  duration?: number;
  onDestroy?: () => void;
  children: React.ReactNode;
};

export function Toast({
  onDestroy,
  duration = DEFAULT_DURATION,
  variant = 'default',
  children,
}: ToastProps) {
  const [isAlive, setIsAlive] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const translateY = useSharedValue(0);

  const dismiss = useCallback(() => {
    setIsAlive(false);
    timers.current.push(setTimeout(() => onDestroy?.(), EXIT_DURATION));
  }, [onDestroy]);

  const scheduleDismiss = useCallback(() => {
    timers.current.push(setTimeout(dismiss, duration));
  }, [dismiss, duration]);

  const pause = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => {
    scheduleDismiss();
    return pause;
  }, [scheduleDismiss, pause]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-12, 12])
        .onStart(() => {
          runOnJS(pause)();
        })
        .onUpdate((event) => {
          translateY.set(
            event.translationY < 0 ? event.translationY : Math.sqrt(event.translationY) * 3,
          );
        })
        .onEnd((event) => {
          if (event.translationY < -24 || event.velocityY < -400) {
            translateY.set(withTiming(-160, { duration: EXIT_DURATION }));
            runOnJS(dismiss)();
          } else {
            translateY.set(withSpring(0, { ...SETTLE_SPRING, velocity: event.velocityY }));
            runOnJS(scheduleDismiss)();
          }
        }),
    [dismiss, pause, scheduleDismiss, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <View pointerEvents="box-none" className="absolute left-4 right-4 top-14">
      {isAlive ? (
        <Animated.View
          entering={SlideInUp.springify().damping(26).stiffness(320)}
          exiting={FadeOutUp.duration(EXIT_DURATION)}
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.shadow, animatedStyle]}>
              <Alert variant={variant} icon={Info}>
                {children}
              </Alert>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
});
