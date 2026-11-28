import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
} from '@oppenheimer/design-system-web';
import { useErrorMessage, useSendVerificationEmail } from '@oppenheimer/frontend-core/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The API's refusal to issue a credential to an account whose address is not
 * verified: an API token, a host pairing token, a routine's webhook URL, an
 * OAuth (MCP) grant. `ErrorAlert` draws this alert in place of its own for it.
 */
export const EMAIL_VERIFICATION_REQUIRED = 'TOKEN_010';

/**
 * `TOKEN_010`, with the way out: the first verification link expires, so the
 * alert offers a new one, says where it went once it is sent, and says so
 * when it could not be sent, with the button still there to try again. The
 * button is locked while the request is in flight, so a double click sends
 * one email.
 */
export function EmailVerificationAlert({
  message,
  correlationId,
  title,
  className,
}: {
  message: string;
  correlationId?: string;
  title?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const resend = useSendVerificationEmail();

  return (
    <Alert tone="danger" className={className}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        {message}
        {correlationId ? (
          <span className="block font-mono text-xs">
            {t('errors.correlationId', { id: correlationId })}
          </span>
        ) : null}
        {resend.isSuccess ? (
          <span role="status" className="block">
            {t('auth.verifyEmail.sent', { email: resend.data })}
          </span>
        ) : null}
        {resend.isError ? (
          <span className="block">
            {resolveError(resend.error, t('auth.verifyEmail.failed')).message}
          </span>
        ) : null}
      </AlertDescription>
      {resend.isSuccess ? null : (
        <AlertAction>
          <Button
            variant="ghost"
            size="sm"
            pending={resend.isPending}
            pendingLabel={t('auth.verifyEmail.sending')}
            onClick={() => {
              if (!resend.isPending) resend.mutate();
            }}
          >
            {t('auth.verifyEmail.resend')}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
