import {
  Bot,
  FilePen,
  FilePlus,
  FileText,
  Globe,
  Hammer,
  ListTodo,
  type LucideIcon,
  MessageCircleQuestion,
  Plug,
  Search,
  SquareTerminal,
} from '@oppenheimer/design-system-web/icons';
import { type ChatToolIcon, type ChatToolKind, toolIcon } from '@oppenheimer/frontend-consumer';
import { groupKindOf } from './chat-blocks';

/** The icon each glyph name the shared classification gives (`toolIcon`) draws in a session's chat. */
const GLYPHS: Record<ChatToolIcon, LucideIcon> = {
  terminal: SquareTerminal,
  file: FileText,
  'file-edit': FilePen,
  'file-new': FilePlus,
  search: Search,
  globe: Globe,
  todo: ListTodo,
  subagent: Bot,
  plan: ListTodo,
  question: MessageCircleQuestion,
  plug: Plug,
  tool: Hammer,
};

/**
 * The glyph a kind of call wears, on its row and on a group of only that
 * kind: a plan or a task list folded into a group wears the group's own.
 */
export function chatToolIcon(kind: ChatToolKind): LucideIcon {
  return GLYPHS[toolIcon(groupKindOf(kind))];
}
