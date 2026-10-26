import { useTranslation } from 'react-i18next';

/**
 * What a loading placeholder says to assistive technology, once: "Loading…"
 * as a polite status, unseen. The placeholder's bars are `aria-hidden`
 * (`Skeleton` is) and its root carries `aria-busy`; this is the one line a
 * screen reader hears while the read is pending
 * (`.agents/rules/frontend-ui.md`, "A placeholder has the shape of what
 * replaces it").
 */
export function LoadingStatus() {
  const { t } = useTranslation();
  return (
    <span role="status" className="sr-only">
      {t('common.loading')}
    </span>
  );
}
