import { AvatarColorPicker } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The bot's colour, a row of the Profile card: its initials on the colour
 * over its name, then the eight colours. A pick shows at once and saves; the
 * sidebar and the chat follow it.
 */
export function BotAvatarColor({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const update = useUpdateBot();
  const color = (update.isPending && update.variables.input.avatarColor) || bot.avatarColor;

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-5 py-5">
      <AvatarColorPicker
        value={color}
        onValueChange={(avatarColor) => update.mutate({ id: bot.id, input: { avatarColor } })}
        initials={bot.initials}
        name={bot.name}
        label={t('bots.settings.profile.color')}
        colorNames={{
          mint: t('bots.settings.profile.colors.mint'),
          tangerine: t('bots.settings.profile.colors.tangerine'),
          snow: t('bots.settings.profile.colors.snow'),
          sky: t('bots.settings.profile.colors.sky'),
          lilac: t('bots.settings.profile.colors.lilac'),
          lemon: t('bots.settings.profile.colors.lemon'),
          coral: t('bots.settings.profile.colors.coral'),
          moss: t('bots.settings.profile.colors.moss'),
        }}
      />
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.profile.failed')}
        onDismiss={() => update.reset()}
      />
    </div>
  );
}
