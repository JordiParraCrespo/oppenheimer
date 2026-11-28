import { BotAvatar, type BotFaceSpec, EmptyState } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * A bot's empty chat, on its own page and beside a session: its face, its
 * name and one line on what it is there for, centred and quiet, leaving the
 * room to the box under it. Until 2026-11-16 the page asked for a job at
 * 34px over four tiles (`bots.md` §3); the owner found it loud.
 */
export function BotHello({
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
        <EmptyState.Description>{t('bots.chat.hello', { name })}</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}
