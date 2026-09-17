import { toast } from '@oppenheimer/design-system-web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** How long a button stays flipped to its "done" state. */
const CONFIRM_MS = 1200;

/**
 * Copy a value, and say so.
 *
 * A clipboard write is silent, so without confirmation there is no way to tell
 * a successful copy from a dead button. Three screens had each grown their own
 * version of this — same `useState`, same 1200ms `setTimeout`, same icon flip —
 * and a fourth (the audit log's "copy id") had no feedback at all.
 *
 * `copied` drives the icon flip for controls where the button *is* the
 * affordance; the toast covers the ones where it is a menu item that has
 * already closed. A second copy restarts the window rather than letting the
 * first timer flip the button back early, and the pending timer is cleared on
 * unmount so it never outlives the button it was flipping.
 */
export function useCopy(): {
  copied: boolean;
  copy: (value: string) => Promise<void>;
} {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Permission can be refused, and over plain HTTP the API is not there
        // at all. The value is on screen either way, so this stays quiet rather
        // than raising an error the reader cannot act on.
        return;
      }

      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
      toast.success(t('toasts.copied'));
    },
    [t],
  );

  return { copied, copy };
}
