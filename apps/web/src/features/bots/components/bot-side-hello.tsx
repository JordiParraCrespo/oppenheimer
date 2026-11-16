import { BotAvatar, type BotFaceSpec, EmptyState } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * A bot's empty chat beside a session: its face, its name and one line on
 * what it is there for, centred and quiet. The bot's own page asks for a job
 * at 34px over tiles; beside a session the work is already in view, so this
 * leaves the room to it and to the box.
 */
export function BotSideHello({
  name,
  initials,
  face,
}: {
  name: string;
  initials: string;
  face: BotFaceSpec;
}) {
  const { t } = useTranslation();
  return (
    <EmptyState>
      <EmptyState.Media>
        <BotAvatar option={{ initials }} size={40} face={face} />
      </EmptyState.Media>
      <EmptyState.Header>
        <EmptyState.Title>{name}</EmptyState.Title>
        <EmptyState.Description>{t('bots.chat.sideHello', { name })}</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}
