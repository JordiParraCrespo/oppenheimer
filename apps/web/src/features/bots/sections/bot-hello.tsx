import {
  type AvatarColor,
  BotAvatar,
  ChatEmptyState,
  ChatTranscript,
  TemplateTile,
  TemplateTiles,
} from '@oppenheimer/design-system-web';
import {
  Globe,
  ListChecks,
  MessageSquareText,
  Newspaper,
  PenLine,
  ScrollText,
} from '@oppenheimer/design-system-web/icons';
import { useBotDocuments } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { fillBotDraft } from '@/features/bots/lib/bot-drafts';

/** What a bot with instructions can be asked to start on. */
const TASKS = [
  { key: 'research', Icon: Globe },
  { key: 'summarise', Icon: ScrollText },
  { key: 'draft', Icon: MessageSquareText },
  { key: 'plan', Icon: ListChecks },
] as const;

/** Jobs a bot with no instructions yet can be given: it writes its own from the answer. */
const JOBS = [
  { key: 'research', Icon: Globe },
  { key: 'writing', Icon: PenLine },
  { key: 'planner', Icon: ListChecks },
  { key: 'news', Icon: Newspaper },
] as const;

/**
 * The bot's hello, before there is a conversation: its face, its name and a
 * line, then four ways to start that fill the composer with a first message
 * to finish and send. A bot with no instructions asks for the job and says
 * it will write its own from it, and offers jobs; one that has them offers
 * tasks. Which it is depends on the instructions, so this reads them
 * (narrowed to "are they blank?") and draws nothing until it knows, rather
 * than greeting one way and switching. A read that fails greets the plain
 * way: the hello is a courtesy, not a fact the reader acts on.
 */
export function BotHello({
  botId,
  name,
  initials,
  color,
}: {
  botId: string;
  name: string;
  initials: string;
  color: AvatarColor;
}) {
  const { t } = useTranslation();
  const { data: blank, isPending } = useBotDocuments(botId, {
    select: (documents) => documents.find((document) => document.name === 'instructions')?.isBlank,
  });
  if (isPending) return null;

  return (
    <ChatTranscript className="items-center">
      <BotAvatar option={{ initials }} size={52} color={color} />
      <ChatEmptyState align="center" title={t('bots.chat.helloTitle', { name })}>
        <p className="m-0 -mt-3 text-center text-body text-pretty text-fg-muted">
          {blank ? t('bots.chat.helloBlank') : t('bots.chat.hello')}
        </p>
        <TemplateTiles>
          {blank
            ? JOBS.map(({ key, Icon }) => (
                <TemplateTile
                  key={key}
                  icon={<Icon />}
                  name={t(`bots.chat.suggest.job.${key}.name`)}
                  description={t(`bots.chat.suggest.job.${key}.description`)}
                  onClick={() => fillBotDraft(botId, t(`bots.chat.suggest.job.${key}.prompt`))}
                />
              ))
            : TASKS.map(({ key, Icon }) => (
                <TemplateTile
                  key={key}
                  icon={<Icon />}
                  name={t(`bots.chat.suggest.task.${key}.name`)}
                  description={t(`bots.chat.suggest.task.${key}.description`)}
                  onClick={() => fillBotDraft(botId, t(`bots.chat.suggest.task.${key}.prompt`))}
                />
              ))}
        </TemplateTiles>
      </ChatEmptyState>
    </ChatTranscript>
  );
}
