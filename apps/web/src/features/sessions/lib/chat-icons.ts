import {
  Bot,
  FilePen,
  FilePlus,
  FileText,
  Globe,
  Hammer,
  type LucideIcon,
  MessageCircleQuestion,
  Plug,
  Search,
  SquareTerminal,
} from '@oppenheimer/design-system-web/icons';
import type { GroupKind } from './chat-blocks';

/** The glyph each kind of call wears, on its row and on a group of only that kind. */
export const CHAT_TOOL_ICONS: Record<GroupKind, LucideIcon> = {
  command: SquareTerminal,
  read: FileText,
  edit: FilePen,
  write: FilePlus,
  search: Search,
  web: Globe,
  agent: Bot,
  question: MessageCircleQuestion,
  mcp: Plug,
  other: Hammer,
};
