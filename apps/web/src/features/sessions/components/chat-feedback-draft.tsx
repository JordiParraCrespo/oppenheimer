import { ComposerStackAction, ComposerStackRow } from '@oppenheimer/design-system-web';
import { MessageSquareWarning } from '@oppenheimer/design-system-web/icons';
import type {
  ChatFeedbackAction,
  ChatFeedbackActionKind,
  ChatFeedbackDraft,
} from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/** The console's words for each key the card names. */
const ACTION_LABELS = {
  review: 'sessions.chat.feedback.review',
  send: 'sessions.chat.feedback.send',
  dismiss: 'sessions.chat.feedback.dismiss',
  back: 'sessions.chat.feedback.back',
  keep: 'sessions.chat.feedback.keep',
  turnOff: 'sessions.chat.feedback.turnOff',
  retry: 'sessions.chat.feedback.retry',
  reviewOrDiscard: 'sessions.chat.feedback.reviewOrDiscard',
} as const satisfies Record<ChatFeedbackActionKind, string>;

/** Escape steps back; the rest act on the draft. */
const ESCAPE = '\u001b';

/**
 * The feedback report the agent drafted, as Claude Code's card over its
 * input box shows it, on top of the chat's composer: its kind and title, the
 * lines of the report the card previews, and under them a pill for each key
 * the card takes now (Review, Send, Dismiss; then Send and Back to confirm a send, Turn
 * off and Keep after a dismiss). A pill types its key into the terminal, the
 * way the person would there (`onPress`). Review opens Claude Code's own
 * editor of the draft, which only the terminal draws, so it also switches to
 * the terminal (`onOpenTerminal`) where the pane can.
 */
export function ChatFeedbackDraftCard({
  draft,
  onPress,
  onOpenTerminal,
}: {
  draft: ChatFeedbackDraft;
  onPress: (action: ChatFeedbackAction) => void;
  onOpenTerminal?: () => void;
}) {
  const { t } = useTranslation();
  const actions = draft.actions.map((action) => {
    return (
      <ComposerStackAction
        key={`${action.key}:${action.action}`}
        variant={action.key === ESCAPE ? 'quiet' : 'outline'}
        onClick={() => {
          onPress(action);
          if (action.opensTerminal) onOpenTerminal?.();
        }}
      >
        {action.kind ? t(ACTION_LABELS[action.kind]) : action.action}
      </ComposerStackAction>
    );
  });
  const foot = [
    draft.kind ? draft.note : null,
    draft.promptHoldsText ? t('sessions.chat.feedback.clearPrompt') : null,
    draft.more > 0 ? t('sessions.chat.feedback.more', { count: draft.more }) : null,
  ].filter((line) => line !== null);
  return (
    <section aria-label={t('sessions.chat.feedback.label')} className="flex flex-col">
      <ComposerStackRow icon={<MessageSquareWarning />} muted>
        {draft.kind ? (
          <>
            <strong>{draft.kind}</strong> {draft.title}
          </>
        ) : (
          draft.note
        )}
      </ComposerStackRow>
      {draft.details.length > 0 ? (
        <p className="m-0 whitespace-pre-wrap break-words px-3 pb-2 text-[12.5px] text-fg-muted leading-[1.45]">
          {draft.details.join('\n')}
        </p>
      ) : null}
      {foot.length > 0 || actions.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-3 pb-2">
          {foot.length > 0 ? (
            <p className="m-0 min-w-0 flex-1 text-[12.5px] text-fg-subtle">{foot.join(' · ')}</p>
          ) : null}
          {actions.length > 0 ? <div className="flex shrink-0 gap-1">{actions}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
