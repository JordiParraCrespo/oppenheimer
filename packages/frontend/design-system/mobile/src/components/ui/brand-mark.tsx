import { cssInterop } from 'nativewind';
import Svg, { G, Line } from 'react-native-svg';
import { cn } from '../../lib/utils';

type SvgProps = React.ComponentProps<typeof Svg> & { className?: string };

/**
 * The plain `<Svg>` taught to read a `className`, the way this package's `Icon`
 * teaches Lucide's icons: NativeWind turns the class into a `style`, the style
 * carries the ink as `color`, and react-native-svg resolves the arms'
 * `currentColor` from it. Without this the mark could only be coloured by a
 * prop, and every caller would have to know the theme.
 */
function ThemedSvg(props: SvgProps) {
  return <Svg {...props} />;
}

cssInterop(ThemedSvg, { className: 'style' });

/**
 * BrandMark — the geometric eight-arm asterisk, the same mark and the same API
 * `@oppenheimer/design-system-web` ships.
 *
 * Drawn in `currentColor` so it inherits the ink around it: `text-ink-900` on
 * light chrome, `text-on-inverse` on a dark card. Size it with `size` (px) or a
 * `size-*` utility on `className`.
 */
function BrandMark({ className, size = 24, ...props }: SvgProps & { size?: number }) {
  return (
    <ThemedSvg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Brand mark"
      className={cn('text-ink-900', className)}
      {...props}
    >
      <G stroke="currentColor" strokeWidth={4.2} strokeLinecap="round">
        <Line x1="24" y1="7" x2="24" y2="41" />
        <Line x1="7" y1="24" x2="41" y2="24" />
        <Line x1="12" y1="12" x2="36" y2="36" />
        <Line x1="36" y1="12" x2="12" y2="36" />
      </G>
    </ThemedSvg>
  );
}

export { BrandMark };
