import { useDeleteBot } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { sectionShowingChat } from '@/features/bots/lib/bot-chat-destination';

/**
 * Delete bot, from the sidebar row, the chat's menu or its settings: the bot,
 * its soul and instructions with their history, and its memory, for good. A
 * reader on one of the bot's pages lands on the Employees list, or on its chat
 * inside a section on that section's own page, since the page they were on is gone; the
 * toast says what went, because the sidebar row it named is already out of sight.
 */
export function DeleteBotDialog({
  bot,
  onClose,
}: {
  bot: { id: string; name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onItsPage = useRouterState({
    select: (state) =>
      state.location.pathname === `/bots/${bot.id}` ||
      state.location.pathname.startsWith(`/bots/${bot.id}/`),
  });
  const sectionHome = useRouterState({
    select: (state) => sectionShowingChat(state.location.pathname, bot.id),
  });
  const remove = useDeleteBot({
    onSuccess: () => {
      onClose();
      notifySuccess('botDeleted', { name: bot.name });
      if (onItsPage) void navigate({ to: '/bots' });
      else if (sectionHome) void navigate({ to: `/${sectionHome}` });
    },
  });

  return (
    <ConfirmDialog
      title={t('bots.delete.title', { name: bot.name })}
      description={t('bots.delete.description')}
      confirmLabel={t('bots.delete.confirm')}
      pendingLabel={t('bots.delete.pending')}
      pending={remove.isPending}
      error={remove.error}
      errorFallback={t('bots.delete.failed')}
      onClose={onClose}
      onConfirm={() => remove.mutate(bot.id)}
    />
  );
}
