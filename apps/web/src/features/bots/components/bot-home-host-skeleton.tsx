import { SettingsGroup, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Two machines, label and status line, at the widths a host's name and details run to. */
const HOSTS = [
  { name: 'w-28', status: 'w-44' },
  { name: 'w-36', status: 'w-52' },
];

/**
 * Home host before the bot and its hosts answer: the Machines heading and the
 * form's card, No home host written as the form writes it (it needs no data),
 * then two hosts as the radio's rows, a ring, a name and a status line each,
 * at the row's height. The save row is not drawn: it appears only after a pick.
 */
export function BotHomeHostSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.homeHost.machines')}</h2>
      <SettingsGroup aria-hidden>
        <div className="flex flex-col gap-1 p-1.5">
          <div className="flex items-start gap-3 px-2.5 py-[7px]">
            <span className="mt-0.5 size-4 shrink-0 rounded-pill border-[1.5px] border-border-strong" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] font-medium text-fg">
                {t('bots.settings.homeHost.none')}
              </span>
              <span className="text-xs leading-[1.4] text-pretty text-fg-muted">
                {t('bots.settings.homeHost.noneHint')}
              </span>
            </span>
          </div>
          {HOSTS.map(({ name, status }) => (
            <div key={name} className="flex items-start gap-3 px-2.5 py-[7px]">
              <Skeleton shape="pill" className="mt-0.5 size-4 shrink-0" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex h-5 items-center">
                  <Skeleton shape="sm" className={`h-3 ${name}`} />
                </span>
                <span className="flex h-4.25 items-center">
                  <Skeleton shape="sm" className={`h-2.5 ${status}`} />
                </span>
              </span>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </section>
  );
}
