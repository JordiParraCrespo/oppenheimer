import {
  PillTab,
  PillTabs,
  SettingsAddRow,
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TOOL_VIEWS } from '@/features/bots/lib/tool-search';

/** The folded groups, at the widths their names run to. */
const GROUPS = ['w-20', 'w-36', 'w-12', 'w-16', 'w-28'];

/**
 * Permissions before they answer: both rule lists with their static titles,
 * an empty row and the add row, which need no data; the grants card with one
 * line; then the tools' search and views, and the groups folded to a line
 * each, their names and summaries as bars.
 */
export function BotPermissionsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-8">
      <LoadingStatus />
      {(['ask', 'allow'] as const).map((effect) => (
        <section key={effect} aria-hidden className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5 px-1">
            <h2 className="eyebrow m-0">{t(`bots.settings.permissions.rules.${effect}.title`)}</h2>
            <p className="m-0 text-sm text-fg-muted">
              {t(`bots.settings.permissions.rules.${effect}.hint`)}
            </p>
          </div>
          <SettingsGroup>
            <SettingsListRow>
              <span className="flex h-5 items-center">
                <Skeleton shape="sm" className="h-3 w-56" />
              </span>
            </SettingsListRow>
            <div inert>
              <SettingsAddRow
                value=""
                onValueChange={() => {}}
                onAdd={() => {}}
                canAdd={false}
                placeholder={t(`bots.settings.permissions.rules.${effect}.placeholder`)}
                addLabel={t('bots.settings.permissions.rules.add')}
                aria-label={t(`bots.settings.permissions.rules.${effect}.new`)}
              />
            </div>
          </SettingsGroup>
        </section>
      ))}
      <section aria-hidden className="flex flex-col gap-2.5">
        <h2 className="eyebrow m-0 px-1">{t('bots.settings.permissions.grants')}</h2>
        <SettingsGroup>
          <SettingsListRow>
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className="h-3 w-44" />
            </span>
          </SettingsListRow>
        </SettingsGroup>
      </section>
      <section aria-hidden className="flex flex-col gap-2.5">
        <SettingsHeading>{t('bots.settings.permissions.tools')}</SettingsHeading>
        <span className="flex h-5 items-center px-1">
          <Skeleton shape="sm" className="h-3 w-96 max-w-full" />
        </span>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Skeleton shape="pill" className="h-7 w-60 max-w-full" />
          <PillTabs size="sm" value="all" onValueChange={() => {}} disabled>
            {TOOL_VIEWS.map((view) => (
              <PillTab key={view} value={view}>
                {t(`bots.settings.permissions.views.${view}`)}
              </PillTab>
            ))}
          </PillTabs>
        </div>
        <div className="flex flex-col gap-1">
          {GROUPS.map((width) => (
            <div key={width} className="flex h-7.5 items-center justify-between px-1">
              <Skeleton shape="sm" className={`h-2.5 ${width}`} />
              <Skeleton shape="sm" className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
