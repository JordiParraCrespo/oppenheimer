import { Button } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A small Open session button under a line that started one: the session a
 * bot started, in a new tab, so the chat stays where it is.
 */
export function OpenSessionButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="xs"
      nativeButton={false}
      render={
        <a href={`/sessions/${encodeURIComponent(sessionId)}`} target="_blank" rel="noopener" />
      }
    >
      <ExternalLink />
      {t('bots.chat.openSession')}
    </Button>
  );
}
