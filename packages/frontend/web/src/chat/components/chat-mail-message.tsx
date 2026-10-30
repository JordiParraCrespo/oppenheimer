import { Paperclip } from '@oppenheimer/design-system-web/icons';
import { type MailPlan, mailAttachmentKey } from '@oppenheimer/shared/schemas/mail';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A message a bot wrote from the owner's Gmail (`product/next-steps/mail.md`
 * §3.3–3.4), the way it goes or was saved: the address it goes from, every
 * recipient, the subject, what the bot wrote and the files. Nothing is cut:
 * on a send card, a yes sends this. What is said about it (sent as is, saved
 * as a draft) is the caller's, as children.
 */
export function ChatMailMessage({ mail, children }: { mail: MailPlan; children?: ReactNode }) {
  const { t } = useTranslation();
  const from = mail.from.name ? `${mail.from.name} <${mail.from.email}>` : mail.from.email;
  const rows: [string, string][] = [
    [t('common.chat.mail.from'), from],
    [t('common.chat.mail.to'), mail.to.join(', ') || t('common.chat.mail.nobody')],
  ];
  if (mail.cc.length) rows.push([t('common.chat.mail.cc'), mail.cc.join(', ')]);
  if (mail.bcc.length) rows.push([t('common.chat.mail.bcc'), mail.bcc.join(', ')]);
  rows.push([t('common.chat.mail.subject'), mail.subject]);

  return (
    <section
      aria-label={t('common.chat.mail.label')}
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
        <p className="m-0 text-xs text-fg-muted">{t('common.chat.mail.fromMail')}</p>
      ) : null}
      <p className="m-0 max-h-72 overflow-y-auto border-t border-border pt-3 text-sm whitespace-pre-wrap break-words text-fg">
        {mail.body}
      </p>
      {mail.attachments.length ? (
        <ul
          aria-label={t('common.chat.mail.files', { count: mail.attachments.length })}
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {mail.attachments.map((file) => (
            <li
              key={mailAttachmentKey(file)}
              className="flex items-center gap-1.5 text-xs text-fg-muted"
            >
              <Paperclip aria-hidden className="size-3.5" />
              {file.filename}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </section>
  );
}
