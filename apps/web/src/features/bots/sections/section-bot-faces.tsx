import { BotFaces } from '@oppenheimer/design-system-web';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { SectionBotFace } from './section-bot-face';

/**
 * The faces a folded Bots heading keeps of the bots placed in `section`, in
 * the Employees order: each opens the bot's chat where its row would, with
 * the row's state on its corner (`useBotRowItem`). The rows' read without
 * Suspense: until it lands, or when it fails, the heading draws no faces and
 * the unfolded list says why. `onUnfold` is the `+N` chip's, when they do not
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
  const { data: bots } = useBots({
    select: (all) => all.filter((bot) => bot.sections.includes(section)),
  });
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
