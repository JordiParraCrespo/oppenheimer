import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { cssInterop, useColorScheme } from 'nativewind';
import type { ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

cssInterop(GlassView, { className: 'style' });
cssInterop(BlurView, { className: 'style' });

/** iOS 26 and later draws Apple's Liquid Glass; everything else gets the system blur. */
const liquidGlass = isLiquidGlassAvailable();

export type GlassProps = ViewProps & {
  className?: string;
  /**
   * Glass that answers a touch (it flexes and catches the light) — for a
   * control drawn as glass. A surface that only holds content leaves it off.
   */
  interactive?: boolean;
  /** A colour the glass is tinted towards, for a primary control. */
  tint?: string;
};

/**
 * A surface of the floating layer: the controls and chrome that sit over the
 * content, never the content itself, as Apple's Liquid Glass guidance draws
 * the line. On iOS 26 it is the system's own `UIGlassEffect`, so it refracts
 * what is behind it and follows light and dark on its own. Earlier iOS and
 * Android get the platform's chrome blur, the nearest material they have.
 */
export function Glass({ className, interactive, tint, children, ...props }: GlassProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tint}
        colorScheme={dark ? 'dark' : 'light'}
        className={cn('overflow-hidden', className)}
        {...props}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={80}
      blurMethod="dimezisBlurViewSdk31Plus"
      className={cn('overflow-hidden border border-border-subtle', className)}
      {...props}
    >
      {children}
    </BlurView>
  );
}

export { liquidGlass };
