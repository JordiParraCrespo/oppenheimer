import {
  AgentMark,
  ChatComposer,
  ComposerContextMeter,
  ComposerFile,
  ComposerStack,
  ComposerStackRow,
  ComposerTaskList,
  FieldError,
} from '@oppenheimer/design-system-web';
import { ListChecks } from '@oppenheimer/design-system-web/icons';
import type { ChatQueued, ChatTodo } from '@oppenheimer/frontend-consumer';
import {
  dictateInto,
  dictationSlots,
  useDictation,
  useLocale,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { SESSION_FILE_ACCEPT } from '@oppenheimer/shared/protocol';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type HeldFile, useHeldFiles } from '../hooks/use-held-files';
import { useTakeFiles } from '../hooks/use-take-files';
import { type ChatContext, formatTokens } from '../lib/chat-blocks';
import type { FileHandOff } from '../lib/file-hand-off';
import { CHAT_MESSAGE_MAX_FILES, refusalText } from '../lib/session-files';
import { ChatQueuedRow } from './chat-queued-row';

/** How a send went: all of it, or the files that reached the host before one did not. */
export type ChatSendResult = { sent: true } | { sent: false; landed: readonly string[] };

/**
 * The chat view's composer. What it sends is typed into the session's
 * terminal, so the agent reads it the way it reads the grid — slash commands
 * included. While the agent works, send becomes Stop, which presses Escape.
 * The agent's current task list is fused on top, the way Codex keeps it in
 * reach. One row under the conversation, its width, with the agent on the
 * left of the line under it and the model it last answered with on the right.
 * The mic before send dictates into the draft, added to its end, to be read
 * before it is sent.
 *
 * **The queue**: a message sent while the agent works waits on the stack,
 * under the tasks, until the turn ends (`SessionChat.post`). Each can be
 * sent now, taken back into the field to edit (ahead of whatever is being
 * written), or dropped. **The context**: how full the agent's context is,
 * beside the model; a click asks the agent to compact it.
 *
 * **Files**, when the pane hands them in (`files`): the paperclip, a paste on
 * the chat and a drop on the pane all go through `useHeldFiles`, New
 * session's rule, and wait as chips over the field until the message goes.
 * A refused one is said under the field. A message may be files alone. While
 * they upload, send is held and says so; what did not reach the host stays,
 * with the words, to be sent again.
 */
export function SessionChatComposer({
  busy,
  todos,
  model,
  voice,
  files: handOff,
  queued,
  context,
  onSend,
  onStop,
  onSendQueued,
  onUnqueue,
  onCompact,
}: {
  /** Who hears a recording: the workspace's dictation, when it has one. */
  voice: VoiceInput;
  busy: boolean;
  todos: ChatTodo[] | null;
  /** The model the agent last answered with, as people say it. */
  model: string | null;
  /** Where the pane hands the files it catches; present, a message can carry files. */
  files?: FileHandOff;
  /** Messages written while the agent worked, waiting for its turn to end. */
  queued: readonly ChatQueued[];
  /** How full the agent's context is, once the host sends its counts. */
  context: ChatContext | null;
  onSend: (text: string, files: HeldFile[]) => Promise<ChatSendResult>;
  onStop: () => void;
  onSendQueued: (id: string) => void;
  /** Takes a queued message back; its text, when it was still there. */
  onUnqueue: (id: string) => string | null;
  onCompact: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const { files, refusal, hold, release } = useHeldFiles(CHAT_MESSAGE_MAX_FILES);
  const picker = useRef<HTMLInputElement>(null);
  const dictation = useDictation({ voice, onText: dictateInto(setDraft) });
  useTakeFiles(handOff, hold);
  const done = todos?.filter((todo) => todo.status === 'completed').length ?? 0;
  // A list the agent has finished is history, which the turn already tells.
  const tasks =
    todos && todos.length > 0 && done < todos.length ? (
      <div className="flex flex-col">
        <ComposerStackRow icon={<ListChecks />} muted>
          {t('sessions.chat.tasks', { done, count: todos.length })}
        </ComposerStackRow>
        <ComposerTaskList
          tasks={todos.map((todo, index) => ({
            id: String(index),
            label: todo.content,
            state:
              todo.status === 'completed'
                ? 'done'
                : todo.status === 'in_progress'
                  ? 'running'
                  : 'todo',
          }))}
        />
      </div>
    ) : null;
  const above =
    tasks || queued.length > 0 ? (
      <ComposerStack>
        {tasks}
        {queued.map((message) => (
          <ChatQueuedRow
            key={message.id}
            queued={message}
            onSendNow={() => onSendQueued(message.id)}
            onEdit={() => {
              const text = onUnqueue(message.id);
              if (text !== null) setDraft((current) => (current ? `${text}\n${current}` : text));
            }}
            onRemove={() => onUnqueue(message.id)}
          />
        ))}
      </ComposerStack>
    ) : undefined;
  const meter = context ? (
    <ComposerContextMeter
      value={context.percent}
      onCompact={onCompact}
      label={t('sessions.chat.context.label', {
        percent: Math.round(context.percent),
        used: formatTokens(context.tokens, locale),
        window: formatTokens(context.window, locale),
      })}
    />
  ) : null;

  async function submit(text: string) {
    const carried = files;
    // Only files take long enough to say so; words alone go at once.
    if (carried.length > 0) setSending(true);
    const result = await onSend(text, carried);
    setSending(false);
    if (result.sent) {
      // What was written while the files uploaded was not sent: it stays.
      setDraft((current) => (current === text ? '' : current));
      // By id, so a file dropped while these uploaded stays for the next message.
      release(carried.map((file) => file.id));
    } else if (result.landed.length > 0) {
      release(result.landed);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {handOff ? (
        <input
          ref={picker}
          type="file"
          multiple
          accept={SESSION_FILE_ACCEPT}
          className="hidden"
          aria-label={t('sessions.chat.composer.attach')}
          onChange={(event) => {
            const picked = Array.from(event.currentTarget.files ?? []);
            // Cleared so choosing the same file again still fires a change.
            event.currentTarget.value = '';
            hold(picked);
          }}
        />
      ) : null}
      <ChatComposer
        value={draft}
        onValueChange={setDraft}
        onSubmit={(text) => void submit(text)}
        onStop={onStop}
        busy={busy && draft.trim() === '' && files.length === 0}
        sendBlockedReason={sending ? t('sessions.chat.composer.attaching') : undefined}
        allowEmpty={files.length > 0}
        placeholder={t('sessions.chat.composer.placeholder')}
        above={above}
        layout="inline"
        dictation={dictationSlots(dictation)}
        onAttach={handOff ? () => picker.current?.click() : undefined}
        attachments={
          files.length > 0
            ? files.map(({ id, file }) => (
                <ComposerFile
                  key={id}
                  name={file.name}
                  removeLabel={t('sessions.chat.composer.removeAttachment', { name: file.name })}
                  onRemove={() => release([id])}
                />
              ))
            : undefined
        }
        tools={
          <span className="flex items-center gap-1.5">
            <AgentMark agent="claude-code" className="size-3.5" />
            {t('sessions.chat.composer.agent')}
          </span>
        }
        engine={
          meter || model ? (
            <>
              {meter}
              {model}
            </>
          ) : undefined
        }
        labels={{
          send: t('sessions.chat.composer.send'),
          stop: t('sessions.chat.composer.stop'),
          attach: t('sessions.chat.composer.attach'),
        }}
      />
      {refusal ? (
        <FieldError className="mx-4.5">
          {refusalText(refusal, t, 'sessions.chat.composer')}
        </FieldError>
      ) : null}
    </div>
  );
}
