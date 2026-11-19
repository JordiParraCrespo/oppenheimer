import { IconButton, Input, useDebouncedCallback } from '@oppenheimer/design-system-web';
import { ChevronDown, ChevronUp, Search, X } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { type KeyboardEvent, type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatState } from '../hooks/use-session-chat';
import { type ChatFindTarget, findInChat } from '../lib/chat-find';

/** How long the field waits after a key before it searches. */
const SETTLE_MS = 150;

/**
 * The session chat's find bar, over the top of the conversation: what is
 * typed is looked for in every turn the chat holds, prompts and replies
 * (`findInChat`), and the chat is brought to a match (`onFind`). It opens on
 * the newest match, since the reader is most often at the end; Enter and the
 * up button go to the one before, Shift+Enter and the down button to the one
 * after, round at either end. Escape closes it. It reads the chat's turns
 * itself, so a turn landing counts again here and nowhere else.
 */
export function SessionChatFind({
  chat,
  inputRef,
  onFind,
  onClose,
}: {
  chat: Chat;
  inputRef: Ref<HTMLInputElement>;
  onFind: (target: ChatFindTarget) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { turns } = useChatState(chat);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const hits = findInChat(turns, query);
  const current = hits.length > 0 ? Math.min(at, hits.length - 1) : -1;

  const settle = useDebouncedCallback((value: string) => {
    const found = findInChat(turns, value);
    const last = found.length - 1;
    setQuery(value);
    setAt(Math.max(0, last));
    onFind({ query: value, hit: found[last] ?? null });
  }, SETTLE_MS);

  const step = (by: number) => {
    if (hits.length === 0) return;
    const next = (current + by + hits.length) % hits.length;
    setAt(next);
    onFind({ query, hit: hits[next] });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      step(event.shiftKey ? 1 : -1);
    }
  };

  return (
    <search
      aria-label={t('sessions.chat.find.label')}
      className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-panel"
    >
      <Input
        ref={inputRef}
        size="sm"
        quiet
        autoFocus
        className="w-56"
        leading={<Search />}
        value={draft}
        placeholder={t('sessions.chat.find.placeholder')}
        aria-label={t('sessions.chat.find.label')}
        onChange={(event) => {
          setDraft(event.target.value);
          settle(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <span
        aria-live="polite"
        className="min-w-16 px-1 text-center text-fg-subtle text-xs tabular-nums"
      >
        {query.trim()
          ? hits.length > 0
            ? t('sessions.chat.find.count', { current: current + 1, total: hits.length })
            : t('sessions.chat.find.none')
          : null}
      </span>
      <IconButton
        size="sm"
        aria-label={t('sessions.chat.find.previous')}
        disabled={hits.length === 0}
        onClick={() => step(-1)}
      >
        <ChevronUp />
      </IconButton>
      <IconButton
        size="sm"
        aria-label={t('sessions.chat.find.next')}
        disabled={hits.length === 0}
        onClick={() => step(1)}
      >
        <ChevronDown />
      </IconButton>
      <IconButton size="sm" aria-label={t('sessions.chat.find.close')} onClick={onClose}>
        <X />
      </IconButton>
    </search>
  );
}
