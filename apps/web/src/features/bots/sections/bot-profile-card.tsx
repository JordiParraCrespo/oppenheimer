import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotProfileForm } from '@/features/bots/forms/bot-profile-form';
import { BotAvatarColor } from './bot-avatar-color';
import { BotGroupSelect } from './bot-group-select';

/**
 * The Profile card: name, description, colour and sidebar group, one draft
 * saved together by the card's Save, like every bot settings page. The
 * colour and the group are rows that bind their own field of the form, and
 * wait while a save is in flight like the text fields do: a pick made then
 * would be overwritten when the saved bot resets the form.
 */
export function BotProfileCard({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [saved, setSaved] = useState(false);
  const save = useUpdateBot({ onSuccess: () => setSaved(true) });

  return (
    <BotProfileForm
      values={{
        name: bot.name,
        description: bot.description,
        avatarColor: bot.avatarColor,
        groupId: bot.groupId,
      }}
      pending={save.isPending}
      saved={saved}
      error={save.error ? resolveError(save.error, t('bots.settings.profile.failed')) : undefined}
      onSubmit={(input) => {
        setSaved(false);
        save.mutate({ id: bot.id, input });
      }}
      onDiscard={() => save.reset()}
    >
      {(control) => (
        <>
          <BotAvatarColor bot={bot} control={control} pending={save.isPending} />
          <BotGroupSelect botId={bot.id} control={control} pending={save.isPending} />
        </>
      )}
    </BotProfileForm>
  );
}
