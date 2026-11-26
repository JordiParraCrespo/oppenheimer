import { BrandMark, ChatHeader, Wordmark } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The whole page of a shared session, the way a session reads in the
 * console: one bar on the terminal's ground at the tab bar's height, and
 * the session filling the width under it. No console around it, since the
 * session is not the guest's: the bar leads with the mark, a way home, and
 * then the session (`title`, its state as `meta`, what the share lets them
 * do as `actions`). A page with no session to name (a refusal, a read in
 * flight) shows the wordmark instead.
 */
export function SharedFrame({
  title,
  meta,
  actions,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh flex-col bg-term-bg">
      <ChatHeader
        leading={
          <Link
            to="/"
            aria-label={t('sessions.shared.home')}
            className="flex shrink-0 items-center rounded-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title ? <BrandMark size={20} /> : <Wordmark size={16} />}
          </Link>
        }
        title={
          title ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="h-4 w-px shrink-0 bg-border-subtle" />
              <span className="truncate">{title}</span>
            </span>
          ) : null
        }
        meta={meta}
        actions={actions}
        className="h-(--tab-bar-h) border-b border-border-subtle bg-term-bg"
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
