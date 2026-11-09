import { createFileRoute } from '@tanstack/react-router';
import { TelegramSettingsScreen } from '@/features/telegram/screens/telegram-settings';

/** Settings → Telegram: the reader's own Telegram bots, polled by their hosts for their bots. */
export const Route = createFileRoute('/_authenticated/settings/telegram')({
  component: TelegramSettingsScreen,
});
