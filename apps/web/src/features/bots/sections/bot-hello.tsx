import {
  ChatEmptyState,
  ChatSuggestion,
  ChatSuggestions,
  ChatTranscript,
  TemplateTile,
  TemplateTiles,
} from '@oppenheimer/design-system-web';
import { Globe, ListChecks, Newspaper, PenLine } from '@oppenheimer/design-system-web/icons';
import { useBotDocuments } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { fillBotDraft } from '@/features/bots/lib/bot-drafts';

/** What a bot with instructions can be asked to start on. */
const TASKS = ['research', 'summarise', 'draft', 'plan'] as const;

/** Jobs a bot with no instructions yet can be given: it writes its own from the answer. */
const JOBS = [
  { key: 'research', Icon: Globe },
  { key: 'writing', Icon: PenLine },
  { key: 'planner', Icon: ListChecks },
  { key: 'news', Icon: Newspaper },
] as const;

/**
 * The bot's hello, before there is a conversation (the Bots frame's empty
 * chat): its name and what it is waiting for at 34px, centred. A bot with no
 * instructions asks for the job and suggests four under Try asking, as
 * tiles; one that has them suggests next steps as pills. Either fills the
 * composer with a first message to finish and send; nothing is applied
 * until it is sent (there are no templates yet, `25-bots.md` §7). Which hello it is
 * depends on the instructions, so this reads them (narrowed to "are they
 * blank?") and draws nothing until it knows, rather than greeting one way
 * and switching. A read that fails greets the plain way: the hello is a
 * courtesy, not a fact the reader acts on.
 */
export function BotHello({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const { data: blank, isPending } = useBotDocuments(botId, {
    select: (documents) => documents.find((document) => document.name === 'instructions')?.isBlank,
  });
  if (isPending) return null;

  return (
    <ChatTranscript>
      {blank ? (
        <ChatEmptyState align="center" title={t('bots.chat.helloBlank', { name })}>
          <div className="flex flex-col gap-2.5">
            <span className="text-micro font-medium text-fg-subtle uppercase">
              {t('bots.chat.startFrom')}
            </span>
            <TemplateTiles>
              {JOBS.map(({ key, Icon }) => (
                <TemplateTile
                  key={key}
                  icon={<Icon />}
                  name={t(`bots.chat.suggest.job.${key}.name`)}
                  description={t(`bots.chat.suggest.job.${key}.description`)}
                  onClick={() => fillBotDraft(botId, t(`bots.chat.suggest.job.${key}.prompt`))}
                />
              ))}
            </TemplateTiles>
          </div>
        </ChatEmptyState>
      ) : (
        <ChatEmptyState align="center" title={t('bots.chat.hello', { name })}>
          <ChatSuggestions className="justify-center">
            {TASKS.map((key) => (
              <ChatSuggestion
                key={key}
                onClick={() => fillBotDraft(botId, t(`bots.chat.suggest.task.${key}.prompt`))}
              >
                {t(`bots.chat.suggest.task.${key}.name`)}
              </ChatSuggestion>
            ))}
          </ChatSuggestions>
        </ChatEmptyState>
      )}
    </ChatTranscript>
  );
}
