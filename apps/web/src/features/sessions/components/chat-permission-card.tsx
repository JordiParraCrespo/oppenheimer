import { ApprovalPanel, Button, Textarea } from '@oppenheimer/design-system-web';
import { type ChatPendingPermission, riskyCommand } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PermissionChoice, permissionChoices } from '../lib/permission-choices';
import { ChatPermissionDetail } from './chat-permission-detail';

/** The card's words for each kind of row; an "always" or a "decline" row adds the agent's own after. */
const LABELS = {
  once: 'sessions.chat.permission.allowOnce',
  always: 'sessions.chat.permission.alwaysAllow',
  decline: 'sessions.chat.permission.deny',
  deny: 'sessions.chat.permission.deny',
  mode: 'sessions.chat.permission.allowOnce',
} as const;

/** The question the card asks, by the kind of call; the agent's own when it names none. */
const TITLES = {
  command: 'sessions.chat.permission.command',
  edit: 'sessions.chat.permission.edit',
  write: 'sessions.chat.permission.write',
  web: 'sessions.chat.permission.web',
} as const;

/**
 * The permission the agent stopped on, answered where the composer was:
 * what it would do (the command, the file and its diff, the tool), then
 * Allow once, Always allow where the agent offers it (in its own words for
 * what it would stop asking about) and Deny. Focus lands on Allow once as
 * the card appears, so 1, 2, 3 pick a row, Enter takes the one focused and
 * Escape denies, as in the agent's terminal. Deny with a note opens a field
 * for what the agent should do instead. A command that can delete or
 * overwrite work tints the card amber, a hint and not a gate.
 *
 * `picked` is the row already chosen, by the dialog's option: the card holds
 * it filled and says where the answer stands until the transcript moves on.
 * `onAnswer` says whether the keys went; when they could not, the card stays
 * to be answered again.
 */
export function ChatPermissionCard({
  pending,
  agentName,
  picked,
  onAnswer,
}: {
  pending: ChatPendingPermission;
  /** Who asks, named in the card's lines ("Claude Code"). */
  agentName: string;
  picked: number | null;
  onAnswer: (option: number, note: string | null) => boolean;
}) {
  const { t } = useTranslation();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const { call, prompt } = pending;
  const choices = permissionChoices(prompt);
  const refusal = choices.find((choice) => choice.kind === 'deny') ?? null;
  const answered = picked !== null;
  const pickedKind = choices.find((choice) => choice.option === picked)?.kind ?? null;
  const caution = call?.kind === 'command' && call.target ? riskyCommand(call.target) : false;
  const title =
    call && call.kind in TITLES
      ? t(TITLES[call.kind as keyof typeof TITLES])
      : call
        ? t('sessions.chat.permission.tool')
        : prompt.title;

  function choose(choice: PermissionChoice | undefined, words: string | null = null) {
    if (!choice || answered) return;
    onAnswer(choice.option, words);
  }

  const status = answered
    ? t(
        pickedKind === 'once' || pickedKind === 'always'
          ? 'sessions.chat.permission.allowed'
          : 'sessions.chat.permission.denied',
        { agent: agentName },
      )
    : caution
      ? t('sessions.chat.permission.caution')
      : t('sessions.chat.permission.keys', { first: 1, last: choices.length });

  return (
    <ApprovalPanel
      autoFocus={!noting}
      tone={caution ? 'caution' : 'default'}
      className="motion-safe:animate-appear"
      title={title}
      tool={call?.label ?? prompt.head ?? undefined}
      detail={<ChatPermissionDetail pending={pending} />}
      choices={choices.map((choice) => ({
        // A refusal that lets the agent go on is said in the agent's words,
        // so it reads apart from Deny.
        label: choice.kind === 'decline' && choice.words ? choice.words : t(LABELS[choice.kind]),
        description:
          choice.kind === 'deny'
            ? t('sessions.chat.permission.denyHint', { agent: agentName })
            : choice.kind === 'always'
              ? (choice.words ?? undefined)
              : undefined,
        tone: choice.kind === 'once' ? 'primary' : choice.kind === 'deny' ? 'danger' : 'default',
      }))}
      picked={answered ? choices.findIndex((choice) => choice.option === picked) : null}
      disabled={answered || noting}
      onChoose={(index) => choose(choices[index])}
      onDismiss={() => choose(refusal ?? undefined)}
      foot={
        noting && refusal ? (
          <div className="flex w-full flex-col gap-2">
            <Textarea
              rows={1}
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setNoting(false);
                } else if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (note.trim()) choose(refusal, note);
                }
              }}
              placeholder={t('sessions.chat.permission.note', { agent: agentName })}
              aria-label={t('sessions.chat.permission.noteLabel', { agent: agentName })}
            />
            <div className="flex items-center gap-2">
              <span className="flex-1">{t('sessions.chat.permission.noteHint')}</span>
              <Button variant="ghost" size="sm" onClick={() => setNoting(false)}>
                {t('sessions.chat.permission.back')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!note.trim() || answered}
                onClick={() => choose(refusal, note)}
              >
                {t('sessions.chat.permission.sendNote')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span className="flex-1" aria-live="polite">
              {status}
            </span>
            {refusal && !answered ? (
              <Button variant="ghost" size="sm" onClick={() => setNoting(true)}>
                {t('sessions.chat.permission.withNote')}
              </Button>
            ) : null}
          </>
        )
      }
    />
  );
}
