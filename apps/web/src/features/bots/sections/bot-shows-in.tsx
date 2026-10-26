import {
  PillGroup,
  PillGroupItem,
  SettingsGroup,
  SettingsRow,
} from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_SECTIONS, type BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Profile's Shows in: the console sections whose sidebar lists the
 * bot under a Bots heading, beside Employees, where every bot is
 * (`28-bots-in-sections.md`). A set that applies the moment a pill flips, as
 * Learn automatically does; while a save is in flight the pills show what
 * was asked for.
 */
export function BotShowsIn({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const update = useUpdateBot();
  const value = update.isPending
    ? [...(update.variables.input.sections ?? bot.sections)]
    : [...bot.sections];

  return (
    <div className="flex flex-col gap-2">
      <SettingsGroup>
        <SettingsRow
          label={t('bots.settings.profile.showsIn')}
          hint={t('bots.settings.profile.showsInHint')}
        >
          <PillGroup
            multiple
            value={value}
            onValueChange={(next) =>
              update.mutate({
                id: bot.id,
                input: { sections: BOT_SECTIONS.filter((section) => next.includes(section)) },
              })
            }
            aria-label={t('bots.settings.profile.showsIn')}
          >
            {BOT_SECTIONS.map((section: BotSection) => (
              <PillGroupItem key={section} value={section}>
                {t(`bots.section.names.${section}`)}
              </PillGroupItem>
            ))}
          </PillGroup>
        </SettingsRow>
      </SettingsGroup>
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.profile.showsInFailed')}
        onDismiss={() => update.reset()}
      />
    </div>
  );
}
