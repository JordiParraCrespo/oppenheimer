import { useTranslation } from 'react-i18next';

/**
 * The whole viewport, waiting: what an app shows before it can mount its
 * router at all (the session is still being restored). One status spinner in
 * the middle of the canvas, announced as loading. Inside the router a route's
 * own skeleton says more than this does.
 */
export function AppPending() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas">
      <div
        role="status"
        aria-label={t('common.loading')}
        className="size-8 animate-spin rounded-full border-2 border-border-subtle border-t-surface-inverse"
      />
    </div>
  );
}
