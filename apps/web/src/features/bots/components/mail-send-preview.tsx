import { Paperclip } from '@oppenheimer/design-system-web/icons';
import type { MailPlan } from '@oppenheimer/shared/schemas/mail';
import { useTranslation } from 'react-i18next';

/**
 * A send card's message (`product/next-steps/mail.md` §3.4), the way it
 * will go: the address it goes from, every recipient, the subject, what the
 * bot wrote and the files. A yes sends this and nothing else, so nothing is
 * cut.
 */
export function MailSendPreview({ mail }: { mail: MailPlan }) {
  const { t } = useTranslation();
  const from = mail.from.name ? `${mail.from.name} <${mail.from.email}>` : mail.from.email;
  const rows: [string, string][] = [
    [t('bots.chat.approval.mail.from'), from],
    [t('bots.chat.approval.mail.to'), mail.to.join(', ') || t('bots.chat.approval.mail.nobody')],
    ...(mail.cc.length
      ? [[t('bots.chat.approval.mail.cc'), mail.cc.join(', ')] as [string, string]]
      : []),
    ...(mail.bcc.length
      ? [[t('bots.chat.approval.mail.bcc'), mail.bcc.join(', ')] as [string, string]]
      : []),
    [t('bots.chat.approval.mail.subject'), mail.subject],
  ];

  return (
    <section
      aria-label={t('bots.chat.approval.mail.label')}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3"
    >
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="m-0 min-w-0 break-words text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {mail.recipientsFromMail ? (
        <p className="m-0 text-xs text-fg-muted">{t('bots.chat.approval.mail.fromMail')}</p>
      ) : null}
      <p className="m-0 max-h-72 overflow-y-auto border-t border-border pt-3 text-sm whitespace-pre-wrap break-words text-fg">
        {mail.body}
      </p>
      {mail.attachments.length ? (
        <ul
          aria-label={t('bots.chat.approval.mail.files', { count: mail.attachments.length })}
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {mail.attachments.map((file) => (
            <li
              key={`${file.messageId}:${file.partId}`}
              className="flex items-center gap-1.5 text-xs text-fg-muted"
            >
              <Paperclip aria-hidden className="size-3.5" />
              {file.filename}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="m-0 text-xs text-fg-subtle">
        {mail.kind === 'draft'
          ? t('bots.chat.approval.mail.draft', { email: mail.accountEmail })
          : [
              mail.original
                ? t(
                    mail.kind === 'forward'
                      ? 'bots.chat.approval.mail.forwards'
                      : 'bots.chat.approval.mail.answers',
                    { from: mail.original.from },
                  )
                : null,
              mail.signature
                ? t('bots.chat.approval.mail.signature', { email: mail.from.email })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
      </p>
    </section>
  );
}
