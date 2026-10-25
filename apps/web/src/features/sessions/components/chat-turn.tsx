import { ChatMarker, ChatUserMessage, TurnHeader } from '@oppenheimer/design-system-web';
import { Paperclip } from '@oppenheimer/design-system-web/icons';
import type { ChatTurn as Turn } from '@oppenheimer/frontend-consumer';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  blocksOf,
  type ChatBlock,
  elapsedOf,
  formatChatElapsed,
  modelName,
} from '../lib/chat-blocks';
import { ChatTurnBlock } from './chat-turn-block';
import { ElapsedClock } from './elapsed-clock';

/** What a folded turn keeps: its words and its cards, what was asked and answered among them. */
const SETTLED_KINDS = new Set<ChatBlock['kind']>(['reply', 'plan', 'question', 'changes']);

/** Every block and the prompt rise into place as they arrive; history fades in once. */
const ENTER = 'motion-safe:animate-appear';

/**
 * One turn of the chat view: what the person sent, as a card on the right,
 * then the agent's turn under its header — working, with its clock running,
 * or how long it worked and on which model. Its thinking and its calls are in
 * muted ink, what it said is markdown, a plan and the files it changed are
 * cards. Codex's way with settled work: the newest turn stays open, an older
 * one folds to its words and its cards, and the header opens it again.
 */
export function ChatTurn({ turn, latest }: { turn: Turn; latest: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(latest);
  // A turn the next prompt has passed folds away; adjusted while rendering,
  // not in an effect, so it never draws open first.
  const [wasLatest, setWasLatest] = useState(latest);
  if (wasLatest !== latest) {
    setWasLatest(latest);
    if (!latest) setOpen(false);
  }
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const blocks = blocksOf(turn);
  const live = turn.working;
  const shown = live || open;

  return (
    <div className="flex flex-col gap-4">
      {turn.prompt ? (
        <ChatUserMessage
          className={ENTER}
          time={turn.prompt.at ? time.format(turn.prompt.at) : undefined}
          attachments={
            turn.prompt.files > 0 ? (
              <ChatMarker icon={<Paperclip />}>
                {t('sessions.chat.files', { count: turn.prompt.files })}
              </ChatMarker>
            ) : undefined
          }
        >
          {turn.prompt.text}
        </ChatUserMessage>
      ) : null}
      {blocks.length > 0 || live ? (
        <TurnHeader
          state={live ? 'working' : 'done'}
          elapsed={
            live && turn.startedAt ? (
              <ElapsedClock since={turn.startedAt} ticking format={formatChatElapsed} />
            ) : (
              (elapsedOf(turn) ?? undefined)
            )
          }
          model={modelName(turn.model) ?? undefined}
          time={!live && turn.lastAt ? time.format(turn.lastAt) : undefined}
          open={shown}
          onToggle={live ? undefined : () => setOpen(!open)}
          labels={{
            working: t('sessions.chat.turn.working'),
            worked: t('sessions.chat.turn.worked'),
            stopped: t('sessions.chat.turn.stopped'),
            interrupted: t('sessions.chat.turn.interrupted'),
          }}
        />
      ) : null}
      {blocks.map((block, index) => {
        const last = index === blocks.length - 1;
        if (!shown && !SETTLED_KINDS.has(block.kind)) return null;
        return (
          <div key={block.id} className={ENTER}>
            <ChatTurnBlock block={block} live={live} last={last} />
          </div>
        );
      })}
    </div>
  );
}
