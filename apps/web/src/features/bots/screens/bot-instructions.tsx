import { SettingsTitle, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotDocuments } from '@/features/bots/sections/bot-documents';

/** `/bots/$botId/settings/instructions`: the two files the bot reads before every message. */
export function BotInstructionsScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.instructions.title')}
        description={t('bots.settings.instructions.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <Skeleton shape="lg" className="h-80 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.instructions.loadFailed')} />
        <QueryState.Data>
          <BotDocuments botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
