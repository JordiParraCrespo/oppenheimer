import {
  BotAvatar,
  ChatHeader,
  ChatTranscript,
  IconButton,
  Skeleton,
  useSidebar,
} from '@oppenheimer/design-system-web';
import { PanelLeft } from '@oppenheimer/design-system-web/icons';
import { useSuspenseBot, useUpdateBotOptimistically } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotActionsMenu } from '@/features/bots/components/bot-actions-menu';
import { BotChatScroller } from '@/features/bots/components/bot-chat-scroller';
import { BotEngineChips } from '@/features/bots/components/bot-engine-chips';
import { BotPermissionChip } from '@/features/bots/components/bot-permission-chip';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { BotComposer } from './bot-composer';
import { BotTranscript } from './bot-transcript';

/**
 * A bot's chat (`design/version1/Bots.dc.html`, `25-bots.md` §3): the header
 * with the sidebar toggle, the bot's face and name and its menu; the
 * transcript, which follows the latest line while you are there and offers
 * the way back when you scroll up; and the
 * composer, whose chips are how the bot's turns start (its model, effort and
 * approval level), each saved on the bot as it is picked. The header, the
 * transcript and the chips all draw this one bot, so it is read here once.
 *
 * The chips are made here, not in the composer, so the draft the composer
 * owns never re-renders them; and this section owns their save. The save
 * writes the pick into the bot it reads, so a picked value shows at once, a
 * refused one snaps back and says why above the box.
 */
export function BotChat({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const { data: bot, error } = useSuspenseBot(botId);
  const update = useUpdateBotOptimistically();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        leading={
          <>
            <IconButton
              variant="quiet"
              size="sm"
              aria-label={t('bots.chat.toggleSidebar')}
              onClick={toggleSidebar}
            >
              <PanelLeft />
            </IconButton>
            <BotAvatar option={{ initials: bot.initials }} size={26} color={bot.avatarColor} />
          </>
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
      <div className="px-5 pb-4">
        <div className="mx-auto flex w-full max-w-184 flex-col gap-2">
          <ErrorAlert
            error={update.error}
            fallback={t('bots.chat.saveFailed')}
            onDismiss={() => update.reset()}
          />
          <BotComposer
            botId={bot.id}
            name={bot.name}
            provider={bot.provider}
            tools={
              <BotPermissionChip
                value={bot.permission}
                onValueChange={(next) => update.mutate({ id: bot.id, input: { permission: next } })}
              />
            }
            engine={
              <BotEngineChips
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
