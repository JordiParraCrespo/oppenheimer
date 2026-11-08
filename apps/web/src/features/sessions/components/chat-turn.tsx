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
  shownImages,
} from '../lib/chat-blocks';
import { ChatImages } from './chat-images';
import { ChatTurnBlock } from './chat-turn-block';
import { ElapsedClock } from './elapsed-clock';

/**
 * What a folded turn keeps besides its answer: its cards and its pictures,
 * what was asked and answered among them, and what a slash command printed,
 * which is that command's whole answer. The words it said on the way there
 * fold with the work they narrated.
 */
const SETTLED_KINDS = new Set<ChatBlock['kind']>([
  'output',
  'plan',
  'question',
  'changes',
  'images',
  'file',
  'subagents',
]);

/**
 * What a folded turn shows: its cards, and its answer, the words it said
 * after its last piece of work, every one of them, since one message's text
 * blocks arrive as replies of their own. The cards it closes on do not end
 * the answer.
 */
function foldedBlocks(blocks: ChatBlock[]): ChatBlock[] {
  const answer = new Set<ChatBlock>();
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index];
    if (block.kind === 'reply') answer.add(block);
    else if (!SETTLED_KINDS.has(block.kind)) break;
  }
  return blocks.filter((block) => answer.has(block) || SETTLED_KINDS.has(block.kind));
}

/** Every block and the prompt rise into place as they arrive; history fades in once. */
const ENTER = 'motion-safe:animate-appear';

/**
 * One turn of the chat view: what the person sent, as a card on the right,
 * the images pasted with it over the card, as tiles that open, then the
 * agent's turn under its header — working, with its clock running,
 * or how long it worked and on which model. Its thinking and its calls are in
 * muted ink, what it said is markdown, a plan and the files it changed are
 * cards. Codex's way with settled work: a turn is open while it works, and
 * once it settles it folds to its answer (its last words) and its cards, the
 * newest one too; the header opens it again.
 */
export function ChatTurn({ turn }: { turn: Turn }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const blocks = blocksOf(turn);
  const live = turn.working;
  const shown = live || open;
  const visible = shown ? blocks : foldedBlocks(blocks);
  const pictures = shownImages(turn.prompt?.images ?? null);
  // A file the host only named, an image without a preview or a document,
  // is a count beside the pictures.
  const named = (turn.prompt?.files ?? 0) - pictures.length;

  return (
    <div className="flex flex-col gap-4">
      {turn.prompt ? (
        <ChatUserMessage
          // A session's chat stands on its terminal's ground, the card's own
          // colour, so the turn takes the blue wash: a shape on it, and the
          // person's words told from the agent's at a glance.
          tone="accent"
          className={ENTER}
          time={turn.prompt.at ? time.format(turn.prompt.at) : undefined}
          attachments={
            pictures.length > 0 || named > 0 ? (
              <>
                {pictures.length > 0 ? <ChatImages images={pictures} align="end" /> : null}
                {named > 0 ? (
                  <ChatMarker icon={<Paperclip />}>
                    {t('sessions.chat.files', { count: named })}
                  </ChatMarker>
                ) : null}
              </>
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
      {visible.map((block, index) => {
        const last = index === visible.length - 1;
        return (
          <div key={block.id} className={ENTER}>
            <ChatTurnBlock block={block} live={live} last={last} />
          </div>
        );
      })}
    </div>
  );
}
