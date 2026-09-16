import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '../lib/utils';

/**
 * Link — the second of the system's two blues. It navigates; a Button acts.
 *
 * No underline at rest, underline on hover with a 2px offset. It inherits the
 * surrounding size so it works inline ("No account? Create one") and as a line
 * of its own ("Back to sign in", "Skip for now"). `muted` renders in the
 * foreground colour for footer-style links where blue would shout.
 *
 * Pass `render` to swap the anchor for the router's link and keep client-side
 * navigation:
 *
 * ```tsx
 * <Link render={<RouterLink to="/sign-in" />}>Back to sign in</Link>
 * ```
 */
function Link({
  className,
  muted,
  render,
  ...props
}: useRender.ComponentProps<'a'> & { muted?: boolean }) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: cn(
          'rounded-xs underline-offset-2 outline-none transition-colors duration-fast hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
          muted ? 'text-fg-muted hover:text-fg' : 'text-link',
          className,
        ),
      },
      props,
    ),
    state: { slot: 'link' },
  });
}

export { Link };
