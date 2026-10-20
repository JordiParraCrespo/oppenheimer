import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Three revisions, as a file's history usually opens: what each did, then its file, number and time. */
const ROWS = [
  { note: 'w-40', meta: 'w-56', current: true },
  { note: 'w-52', meta: 'w-52', current: false },
  { note: 'w-32', meta: 'w-56', current: false },
];

/**
 * A document's revision history before it answers: the heading written, then
 * the card with three rows on the row's own frame, a bar for who wrote it in
 * the lead's pill, one for what it did and one for its meta line. The newest
 * says Current, as it will; the others hold a bar where Revert goes.
 */
export function BotRevisionsSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.instructions.history')}</h2>
      <SettingsGroup aria-hidden>
        {ROWS.map(({ note, meta, current }) => (
          <SettingsListRow
            key={note}
            align="center"
            lead={<Skeleton shape="sm" className="h-2 w-6" />}
            meta={
              <span className="flex h-4.5 items-center">
                <Skeleton shape="sm" className={`h-2.5 ${meta}`} />
              </span>
            }
            actions={
              current ? (
                t('bots.settings.instructions.current')
              ) : (
                <Skeleton shape="pill" className="h-7 w-17" />
              )
            }
          >
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className={`h-3 ${note}`} />
            </span>
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </section>
  );
}
