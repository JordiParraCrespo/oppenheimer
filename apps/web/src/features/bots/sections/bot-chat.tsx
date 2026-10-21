import { BotAvatar, ChatTranscript, Skeleton } from '@oppenheimer/design-system-web';
import { useSuspenseBot, useUpdateBotOptimistically } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, PageBar, QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotActionsMenu } from '@/features/bots/components/bot-actions-menu';
import { BotChatScroller } from '@/features/bots/components/bot-chat-scroller';
import { BotPermissionChip } from '@/features/bots/components/bot-permission-chip';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { useKeyedProvider } from '@/features/bots/hooks/use-keyed-provider';
import { BotApprovalCard } from './bot-approval-card';
import { BotComposer } from './bot-composer';
import { BotEngine } from './bot-engine';
import { BotTranscript } from './bot-transcript';

/**
 * A bot's chat (`design/version1/Bots.dc.html`, `25-bots.md` §3): its
 * `PageBar`, the sidebar toggle, the bot's face and name and its menu; the
 * transcript, which follows the latest line while you are there and offers
 * the way back when you scroll up; and the
 * composer, whose chips are how the bot's turns start (its model, effort and
 * approval level), each saved on the bot as it is picked. The header, the
 * transcript and the chips all draw this one bot, so it is read here once.
 *
 * The chips are made here, not in the composer, so the draft the composer
 * owns never re-renders them; and this section owns their save. The save
 * writes the pick into the bot it reads, so a picked value shows at once, a
 * refused one snaps back and says why above the box. A bot left on a provider
 * with no key, while another has one, is moved onto it the same way.
 */
export function BotChat({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: bot, error } = useSuspenseBot(botId);
  const update = useUpdateBotOptimistically();
  const [deleting, setDeleting] = useState(false);
  useKeyedProvider(bot.provider, (next) => update.mutate({ id: bot.id, input: next }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageBar
        leading={
          <BotAvatar option={{ initials: bot.initials }} size={26} color={bot.avatarColor} />
        }
        title={bot.name}
        actions={
          <BotActionsMenu
            onSettings={() =>
              navigate({ to: '/bots/$botId/settings/profile', params: { botId: bot.id } })
            }
            onDelete={() => setDeleting(true)}
          />
        }
      />
      <BotChatScroller>
        <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
        <QueryState>
          <QueryState.Pending>
            <ChatTranscript>
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </ChatTranscript>
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.chat.loadFailed')} />
          <QueryState.Data>
            <BotTranscript botId={bot.id} name={bot.name} />
          </QueryState.Data>
        </QueryState>
      </BotChatScroller>
      <div className="px-4 pb-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-190 flex-col gap-2">
          <BotApprovalCard botId={bot.id} name={bot.name} />
          <ErrorAlert
            error={update.error}
            fallback={t('bots.chat.saveFailed')}
            onDismiss={() => update.reset()}
          />
          <BotComposer
            key={bot.id}
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
              <BotEngine
                provider={bot.provider}
                model={bot.model}
                effort={bot.effort}
                onModelChange={(next) => update.mutate({ id: bot.id, input: next })}
                onEffortChange={(next) => update.mutate({ id: bot.id, input: { effort: next } })}
              />
            }
          />
        </div>
      </div>
      {deleting ? <DeleteBotDialog bot={bot} onClose={() => setDeleting(false)} /> : null}
    </div>
  );
}
