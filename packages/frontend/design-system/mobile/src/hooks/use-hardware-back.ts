import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Claims Android's hardware back while `enabled`, so a layer on top of the
 * screen answers it instead of the navigator underneath. No-op on iOS.
 */
export function useHardwareBack(enabled: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [enabled]);
}
