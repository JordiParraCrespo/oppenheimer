import { BotFaces, IconButton } from '@oppenheimer/design-system-web';
import { RotateCw } from '@oppenheimer/design-system-web/icons';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { SectionBotFace } from './section-bot-face';

/**
 * The faces a folded Bots heading keeps of the bots placed in `section`, in
 * the Employees order: each opens the bot's chat where its row would, with
 * the row's state on its corner (`useBotRowItem`). The rows' read without
 * Suspense: until it lands the heading draws no faces; a first read that
 * fails draws a retry that says so, and a refetch that fails keeps the faces. `onUnfold` is the `+N` chip's, when they do not
 * all fit.
 */
export function SectionBotFaces({
  section,
  onUnfold,
}: {
  section: BotSection;
  onUnfold: () => void;
}) {
  const { t } = useTranslation();
  const {
    data: bots,
    isError,
    refetch,
  } = useBots({
    select: (all) => all.filter((bot) => bot.sections.includes(section)),
  });
  if (!bots && isError) {
    const failed = `${t('bots.sidebar.loadFailed')} ${t('common.retry')}`;
    return (
      <IconButton
        variant="quiet"
        size="xs"
        aria-label={failed}
        title={failed}
        onClick={() => refetch()}
      >
        <RotateCw />
      </IconButton>
    );
  }
  if (!bots || bots.length === 0) return null;
  return (
    <BotFaces
      aria-label={t('bots.section.heading')}
      moreLabel={(count) => t('bots.section.more', { count })}
      onMore={onUnfold}
    >
      {bots.map((bot) => (
        <SectionBotFace key={bot.id} bot={bot} section={section} />
      ))}
    </BotFaces>
  );
}
