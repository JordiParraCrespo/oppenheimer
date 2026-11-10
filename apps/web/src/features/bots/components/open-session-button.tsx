import { Button } from '@oppenheimer/design-system-web';
import { ArrowUpRight } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Open session, as an outlined button on the line of the call that started
 * one, so it reads as the way into that session and not as one more quiet
 * trace line: the session in a new tab, so the chat stays where it is.
 */
export function OpenSessionButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      size="xs"
      nativeButton={false}
      render={
        <a href={`/sessions/${encodeURIComponent(sessionId)}`} target="_blank" rel="noopener" />
      }
    >
      {t('bots.chat.openSession')}
      <ArrowUpRight />
    </Button>
  );
}
