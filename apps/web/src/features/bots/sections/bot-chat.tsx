import { BotAvatar } from '@oppenheimer/design-system-web';
import { useSuspenseBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, PageBar } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotActionsMenu } from '@/features/bots/components/bot-actions-menu';
import { ToolCallsToggle } from '@/features/bots/components/tool-calls-toggle';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { useToolCallsShown } from '@/features/bots/hooks/use-tool-calls-shown';
import { BotChatBody } from './bot-chat-body';

/**
 * A bot's chat (`design/version1/Bots.dc.html`, `25-bots.md` §3): its
 * `PageBar`, the sidebar toggle, the bot's face and name, the wrench that
 * shows or hides its tool calls (kept on this device) and its menu, over the
 * conversation (`BotChatBody`). The header and the conversation both draw
 * this one bot, so it is read here once.
 */
export function BotChat({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: bot, error } = useSuspenseBot(botId);
  const [deleting, setDeleting] = useState(false);
  const toolCalls = useToolCallsShown();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageBar
        leading={<BotAvatar option={{ initials: bot.initials }} size={26} face={bot.face} />}
        title={bot.name}
        actions={
          <>
            <ToolCallsToggle shown={toolCalls.shown} onShownChange={toolCalls.setShown} />
            <BotActionsMenu
              onSettings={() =>
                navigate({ to: '/bots/$botId/settings/profile', params: { botId: bot.id } })
              }
              onDelete={() => setDeleting(true)}
            />
          </>
        }
      />
      <BotChatBody bot={bot} toolCallsShown={toolCalls.shown}>
        <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
      </BotChatBody>
      {deleting ? <DeleteBotDialog bot={bot} onClose={() => setDeleting(false)} /> : null}
    </div>
  );
}
