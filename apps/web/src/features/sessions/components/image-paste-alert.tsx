import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * Why an image pasted onto the terminal did not reach the session. It stays
 * until it is dismissed or the next image is pasted: a failure is read, not
 * glanced at.
 */
export function ImagePasteAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertTitle>{t('sessions.session.image.failedTitle')}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t('sessions.session.image.dismiss')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
