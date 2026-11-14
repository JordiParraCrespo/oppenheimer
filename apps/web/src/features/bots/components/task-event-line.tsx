import { TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  CirclePlus,
  FolderInput,
  Link,
  LockOpen,
  OctagonAlert,
  RotateCcw,
  Trash2,
} from '@oppenheimer/design-system-web/icons';
import type { BotTaskEvent } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** The line's words by what Plan logged. */
const TASK_KEYS = {
  created: 'bots.chat.event.task.created',
  status_changed: 'bots.chat.event.task.status_changed',
  completed: 'bots.chat.event.task.completed',
  reopened: 'bots.chat.event.task.reopened',
  blocked: 'bots.chat.event.task.blocked',
  unblocked: 'bots.chat.event.task.unblocked',
  deleted: 'bots.chat.event.task.deleted',
  rescheduled: 'bots.chat.event.task.rescheduled',
  reassigned: 'bots.chat.event.task.reassigned',
  session_linked: 'bots.chat.event.task.session_linked',
} as const;

const TASK_ICONS: Record<BotTaskEvent['event'], ReactNode> = {
  created: <CirclePlus />,
  status_changed: <ArrowRight />,
  completed: <CircleCheck />,
  reopened: <RotateCcw />,
  blocked: <OctagonAlert />,
  unblocked: <LockOpen />,
  deleted: <Trash2 />,
  rescheduled: <CalendarClock />,
  reassigned: <FolderInput />,
  session_linked: <Link />,
};

const COLUMN_KEYS = {
  todo: 'bots.chat.event.task.column.todo',
  doing: 'bots.chat.event.task.column.doing',
  review: 'bots.chat.event.task.column.review',
  done: 'bots.chat.event.task.column.done',
} as const;

/**
 * A task on a project or milestone the bot follows that woke it
 * (`27-bot-subscriptions.md` §7.2): "“Ship the docs” moved from Not started
 * to In progress", in red when it was blocked. Drawn from what Plan logged.
 */
export function TaskEventLine({ event }: { event: BotTaskEvent }) {
  const { t } = useTranslation();
  const line = t(TASK_KEYS[event.event], {
    title: event.title,
    from: event.from ? t(COLUMN_KEYS[event.from]) : '',
    to: event.to ? t(COLUMN_KEYS[event.to]) : '',
  });
  return (
    <TranscriptDivider
      icon={TASK_ICONS[event.event]}
      tone={event.event === 'blocked' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={line}>
        {line}
      </span>
    </TranscriptDivider>
  );
}
