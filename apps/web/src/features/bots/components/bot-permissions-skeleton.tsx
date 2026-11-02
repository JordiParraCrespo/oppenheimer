import {
  SettingsAddRow,
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  SettingsRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** A few tools at the widths their names and sentences run to. */
const TOOLS = [
  { name: 'w-36', hint: 'w-64' },
  { name: 'w-28', hint: 'w-72' },
  { name: 'w-40', hint: 'w-56' },
];

/**
 * Permissions before they answer: both rule lists with their static titles,
 * an empty row and the add row, which need no data; the grants card with one
 * line; then a group of tools on the row's frame, the name and sentence as
 * bars and Allow · Ask · Off as pill-shaped bars.
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
        <SettingsGroup>
          {TOOLS.map(({ name, hint }) => (
            <SettingsRow
              key={name}
              label={<Skeleton shape="sm" className={`h-3 ${name}`} />}
              hint={<Skeleton shape="sm" className={`mt-1 h-2.5 ${hint}`} />}
            >
              <Skeleton shape="pill" className="h-7.5 w-16" />
              <Skeleton shape="pill" className="h-7.5 w-12" />
              <Skeleton shape="pill" className="h-7.5 w-11" />
            </SettingsRow>
          ))}
        </SettingsGroup>
      </section>
    </div>
  );
}
