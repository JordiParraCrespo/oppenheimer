import {
  AgentMark,
  ChatComposer,
  ComposerStack,
  ComposerStackRow,
  ComposerTaskList,
} from '@oppenheimer/design-system-web';
import { ListChecks } from '@oppenheimer/design-system-web/icons';
import type { ChatTodo } from '@oppenheimer/frontend-consumer';
import {
  dictateInto,
  dictationSlots,
  useDictation,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The chat view's composer. What it sends is typed into the session's
 * terminal, so the agent reads it the way it reads the grid — slash commands
 * included. While the agent works, send becomes Stop, which presses Escape.
 * The agent's current task list is fused on top, the way Codex keeps it in
 * reach. One row under the conversation, its width, with the agent on the
 * left of the line under it and the model it last answered with on the right.
 * The mic before send dictates into the draft, added to its end, to be read
 * before it is sent.
 */
export function SessionChatComposer({
  busy,
  todos,
  model,
  voice,
  onSend,
  onStop,
}: {
  /** Who hears a recording: the workspace's dictation, when it has one. */
  voice: VoiceInput;
  busy: boolean;
  todos: ChatTodo[] | null;
  /** The model the agent last answered with, as people say it. */
  model: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const dictation = useDictation({ voice, onText: dictateInto(setDraft) });
  const done = todos?.filter((todo) => todo.status === 'completed').length ?? 0;
  // A list the agent has finished is history, which the turn already tells.
  const above =
    todos && todos.length > 0 && done < todos.length ? (
      <ComposerStack>
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
      </ComposerStack>
    ) : undefined;

  return (
    <ChatComposer
      value={draft}
      onValueChange={setDraft}
      onSubmit={(text) => {
        onSend(text);
        setDraft('');
      }}
      onStop={onStop}
      busy={busy && draft.trim() === ''}
      placeholder={t('sessions.chat.composer.placeholder')}
      above={above}
      layout="inline"
      dictation={dictationSlots(dictation)}
      tools={
        <span className="flex items-center gap-1.5">
          <AgentMark agent="claude-code" className="size-3.5" />
          {t('sessions.chat.composer.agent')}
        </span>
      }
      engine={model ?? undefined}
      labels={{ send: t('sessions.chat.composer.send'), stop: t('sessions.chat.composer.stop') }}
    />
  );
}
