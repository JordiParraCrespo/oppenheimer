import { AvatarColorPicker } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BotProfileControl } from '@/features/bots/forms/bot-profile-form';

/**
 * The bot's colour, a row of the Profile card: its initials on the colour
 * over its name, then the eight colours. A pick changes the card's draft;
 * the sidebar and the chat follow once it is saved.
 */
export function BotAvatarColor({
  bot,
  control,
  pending,
}: {
  bot: Pick<BotEntity, 'initials' | 'name'>;
  control: BotProfileControl;
  /** A save is in flight: the pick waits for it. */
  pending: boolean;
}) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'avatarColor' });

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-5 py-5">
      <AvatarColorPicker
        value={field.value}
        onValueChange={field.onChange}
        disabled={pending}
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
    </div>
  );
}
