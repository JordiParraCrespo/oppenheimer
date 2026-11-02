import type { MailPlan } from '@oppenheimer/shared/schemas/mail';
import { useTranslation } from 'react-i18next';

/**
 * What a send card adds under the message (`product/next-steps/mail.md`
 * §3.4): a draft goes as it stands in Gmail; anything else says the message
 * it answers or forwards, and the signature that goes below it.
 */
export function ChatMailSendNote({ mail }: { mail: MailPlan }) {
  const { t } = useTranslation();
  const parts =
    mail.kind === 'draft'
      ? [t('common.chat.mail.draft', { email: mail.accountEmail })]
      : [
          mail.original
            ? t(
                mail.kind === 'forward' ? 'common.chat.mail.forwards' : 'common.chat.mail.answers',
                {
                  from: mail.original.from,
                },
              )
            : null,
          mail.signature ? t('common.chat.mail.signature', { email: mail.from.email }) : null,
        ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return <p className="m-0 text-xs text-fg-subtle">{parts.join(' · ')}</p>;
}
