import { searchPage, searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** A number's chats page shows groups or people, one at a time. */
export const CHAT_TABS = ['group', 'person'] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

/**
 * A number's chats page's search, so a narrowed list is a link: the tab, the
 * words, who answers (`answered`, `none`, `default`, or a bot's id) and the
 * page. Each default is written as no key.
 */
export const whatsappChatsSearchSchema = z.object({
  tab: z.enum(CHAT_TABS).optional().catch(undefined),
  q: searchText,
  by: searchText,
  page: searchPage,
});
export type WhatsappChatsSearch = z.infer<typeof whatsappChatsSearchSchema>;
