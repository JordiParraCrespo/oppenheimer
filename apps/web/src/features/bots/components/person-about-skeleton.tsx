import { Button, Skeleton, Textarea } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * About you before it answers: the heading and hint as they read, the box at
 * its own height with nothing in it, and the save row's line as a bar beside
 * Save, which needs no data.
 */
export function PersonAboutSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <div className="flex flex-col gap-1 px-1">
        <h2 className="eyebrow m-0">{t('settings.memory.aboutTitle')}</h2>
        <p className="m-0 text-sm text-fg-subtle">{t('settings.memory.aboutHint')}</p>
      </div>
      <Textarea aria-hidden disabled tabIndex={-1} rows={6} />
      <div aria-hidden className="flex items-center gap-2">
        <span className="flex flex-1 items-center">
          <Skeleton shape="sm" className="h-3 w-28" />
        </span>
        <Button size="sm" disabled tabIndex={-1}>
          {t('settings.memory.save')}
        </Button>
      </div>
    </section>
  );
}
