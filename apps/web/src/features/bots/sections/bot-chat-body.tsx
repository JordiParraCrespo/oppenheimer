import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotDocuments, useUpdateBotOptimistically } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotChatScroller } from '@/features/bots/components/bot-chat-scroller';
import { BotPermissionChip } from '@/features/bots/components/bot-permission-chip';
import { BotTranscriptSkeleton } from '@/features/bots/components/bot-transcript-skeleton';
import { useKeyedProvider } from '@/features/bots/hooks/use-keyed-provider';
import { ToolCallsShownContext } from '@/features/bots/hooks/use-tool-calls-shown';
import { BotApprovalCard } from './bot-approval-card';
import { BotComposer } from './bot-composer';
import { BotEngine } from './bot-engine';
import { BotQuestionCard } from './bot-question-card';
import { BotTranscript } from './bot-transcript';
import { BotUsage } from './bot-usage';
import { BotUsageCard } from './bot-usage-card';

/**
 * A bot's conversation under whatever heads it: the transcript, which follows
 * the latest line while you are there and offers the way back when you scroll
 * up, and the composer, whose chips are how the bot's turns start (its model,
 * effort and approval level), each saved on the bot as it is picked, after
 * the meter of the room the bot has left (`BotUsage`). Its own page draws it
 * under the `PageBar` (`BotChat`); a session's side pane under its tab.
 * `children` lead the transcript: the head's failure to read the bot again.
 *
 * The chips are made here, not in the composer, so the draft the composer
 * owns never re-renders them; and this section owns their save. The save
 * writes the pick into the bot it reads, so a picked value shows at once, a
 * refused one snaps back and says why above the box. A bot left on a provider
 * with no key, while another has one, is moved onto it the same way.
 */
export function BotChatBody({
  bot,
  toolCallsShown,
  hello,
  layout = 'stacked',
  children,
}: {
  bot: BotEntity;
  /** Whether the transcript shows each turn's tool calls, the head's choice. */
  toolCallsShown: boolean;
  /** What greets an empty chat; the bot's own page's hello when absent. */
  hello?: ReactNode;
  /** The composer's layout: `inline` beside a session, a row with its chips under it. */
  layout?: 'stacked' | 'inline';
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const update = useUpdateBotOptimistically();
  useKeyedProvider(bot.provider, (next) => update.mutate({ id: bot.id, input: next }));
  // Starts the documents' read beside the conversation's, so a chat with no
  // messages yet greets with its hello as the transcript lands, not a round
  // trip later. Nothing here reads the result, and an empty
  // `notifyOnChangeProps` keeps the read's fetch states from redrawing the chat.
  useBotDocuments(bot.id, { notifyOnChangeProps: [] });

  return (
    <>
      <ToolCallsShownContext value={toolCallsShown}>
        <BotChatScroller>
          {children}
          <QueryState>
            <QueryState.Pending>
              <div aria-busy>
                <BotTranscriptSkeleton />
              </div>
            </QueryState.Pending>
            <QueryState.Error fallback={t('bots.chat.loadFailed')} />
            <QueryState.Data>
              <BotTranscript botId={bot.id} name={bot.name} hello={hello} />
            </QueryState.Data>
          </QueryState>
          <BotUsageCard botId={bot.id} />
        </BotChatScroller>
      </ToolCallsShownContext>
      <div className={layout === 'inline' ? 'px-3 pb-3' : 'px-4 pb-4 sm:px-8'}>
        <div className="mx-auto flex w-full max-w-190 flex-col gap-2">
          <BotApprovalCard botId={bot.id} name={bot.name} />
          <BotQuestionCard botId={bot.id} />
          <ErrorAlert
            error={update.error}
            fallback={t('bots.chat.saveFailed')}
            onDismiss={() => update.reset()}
          />
          <BotComposer
            key={bot.id}
            layout={layout}
            botId={bot.id}
            name={bot.name}
            provider={bot.provider}
            model={bot.model}
            tools={
              <BotPermissionChip
                value={bot.permission}
                onValueChange={(next) => update.mutate({ id: bot.id, input: { permission: next } })}
              />
            }
            engine={
              <>
                <BotUsage botId={bot.id} />
                <BotEngine
                  provider={bot.provider}
                  model={bot.model}
                  effort={bot.effort}
                  onModelChange={(next) => update.mutate({ id: bot.id, input: next })}
                  onEffortChange={(next) => update.mutate({ id: bot.id, input: { effort: next } })}
                />
              </>
            }
          />
        </div>
      </div>
    </>
  );
}
