import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotProfileForm } from '@/features/bots/forms/bot-profile-form';
import { BotAvatarColor } from './bot-avatar-color';
import { BotGroupSelect } from './bot-group-select';

/**
 * The Profile card: the name and description the save row commits, and the
 * colour and sidebar group, which save as they are picked. This owns the
 * form's save; each picker owns its own, so a refused colour does not read
 * as a refused name.
 */
export function BotProfileCard({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [saved, setSaved] = useState(false);
  const save = useUpdateBot({ onSuccess: () => setSaved(true) });

  return (
    <BotProfileForm
      values={{ name: bot.name, description: bot.description }}
      pending={save.isPending}
      saved={saved}
      error={save.error ? resolveError(save.error, t('bots.settings.profile.failed')) : undefined}
      onSubmit={(input) => {
        setSaved(false);
        save.mutate({ id: bot.id, input });
      }}
      onDiscard={() => save.reset()}
    >
      <BotAvatarColor bot={bot} />
      <BotGroupSelect bot={bot} />
    </BotProfileForm>
  );
}
