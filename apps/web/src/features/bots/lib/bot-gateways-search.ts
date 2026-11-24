import { z } from 'zod';

/** A bot's Gateways page in one view per channel people reach it on. */
export const BOT_GATEWAY_TABS = ['whatsapp', 'telegram', 'slack'] as const;
export type BotGatewayTab = (typeof BOT_GATEWAY_TABS)[number];

/** The page's search, so a tab is a link; WhatsApp, the default, is no key. */
export const botGatewaysSearchSchema = z.object({
  tab: z.enum(BOT_GATEWAY_TABS).optional().catch(undefined),
});
export type BotGatewaysSearch = z.infer<typeof botGatewaysSearchSchema>;
