import { Bell, Bot, GitPullRequest, Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import type { InboxItemKind } from '@oppenheimer/frontend-consumer';

/** The glyph for an item's kind, the rail's own: a terminal, a bell, a bot, a pull request, a bolt. A bot's notice is the bot's. */
export function InboxKindIcon({ kind }: { kind: InboxItemKind }) {
  switch (kind) {
    case 'session':
      return <Terminal />;
    case 'notice':
      return <Bell />;
    case 'approval':
    case 'botNotice':
      return <Bot />;
    case 'pull':
      return <GitPullRequest />;
    case 'run':
      return <Zap />;
  }
}
