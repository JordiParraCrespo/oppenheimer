import {
  ChatComposer,
  ComposerStack,
  ComposerStackRow,
  ComposerTaskList,
} from '@oppenheimer/design-system-web';
import { ListChecks } from '@oppenheimer/design-system-web/icons';
import type { ChatTodo } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The chat view's composer. What it sends is typed into the session's
 * terminal, so the agent reads it the way it reads the grid — slash commands
 * included. While the agent works, send becomes Stop, which presses Escape.
 * The agent's current task list is fused on top, the way Codex keeps it in
 * reach.
 */
export function SessionChatComposer({
  busy,
  todos,
  onSend,
  onStop,
}: {
  busy: boolean;
  todos: ChatTodo[] | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
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
      labels={{ send: t('sessions.chat.composer.send'), stop: t('sessions.chat.composer.stop') }}
    />
  );
}
