import {
  AlarmClock,
  Bell,
  Bot,
  CircleCheck,
  Flag,
  GitPullRequest,
  Hourglass,
  Terminal,
} from '@oppenheimer/design-system-web/icons';
import type { InboxItemKind } from '@oppenheimer/frontend-consumer';

/** The glyph for an item's kind, the rail's own: a terminal, a bell, a bot, a pull request, an alarm clock, an hourglass on a session left unattended, a flag on a problem reported, Plan's tick on a task an agent made. A bot's notice is the bot's. */
export function InboxKindIcon({ kind }: { kind: InboxItemKind }) {
  switch (kind) {
    case 'session':
      return <Terminal />;
    case 'unattended':
      return <Hourglass />;
    case 'notice':
      return <Bell />;
    case 'approval':
    case 'botNotice':
      return <Bot />;
    case 'pull':
      return <GitPullRequest />;
    case 'run':
      return <AlarmClock />;
    case 'report':
      return <Flag />;
    case 'task':
      return <CircleCheck />;
  }
}
