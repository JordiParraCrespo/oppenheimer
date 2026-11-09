import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LoadingAnnouncerContext,
  type RegisterPlaceholder,
  useLoadingAnnouncement,
} from '../hooks/use-loading-announcement';

/**
 * The one "Loading…" a screen reader hears, for the whole app. Every
 * placeholder on screen counts itself in (`LoadingStatus`, and each
 * `QueryState.Pending` on its own), and the region says "Loading…" while any
 * is mounted: a page drawing five placeholders at once announces once, and a
 * nested one has nothing to opt out of. The region is mounted before any
 * placeholder, so a reader hears its text change rather than missing a region
 * that appeared with its text already in it. `aria-live` is written out, not
 * left to the role: a modal dialog hides everything outside it from assistive
 * technology except `[aria-live]` regions, and a placeholder inside a dialog
 * counts into this one.
 */
export function LoadingAnnouncer({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [register] = useState<RegisterPlaceholder>(() => () => {
    setCount((current) => current + 1);
    return () => setCount((current) => current - 1);
  });

  return (
    <LoadingAnnouncerContext value={register}>
      {children}
      <span role="status" aria-live="polite" className="sr-only">
        {count > 0 ? t('common.loading') : ''}
      </span>
    </LoadingAnnouncerContext>
  );
}

/**
 * What a loading placeholder says to assistive technology: "Loading…", once.
 * Under the app's `LoadingAnnouncer` it renders nothing and counts itself into
 * that one region; outside it (a page drawn before the app's root, a test) it
 * is its own polite status, unseen. The placeholder's bars are `aria-hidden`
 * (`Skeleton` is) and its root carries `aria-busy`
 * (`.agents/rules/frontend-ui.md`, "A placeholder has the shape of what
 * replaces it").
 */
export function LoadingStatus() {
  const { t } = useTranslation();
  if (useLoadingAnnouncement()) return null;
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {t('common.loading')}
    </span>
  );
}
