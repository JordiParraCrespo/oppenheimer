import type { HostLinkLabels } from '@oppenheimer/design-system-web';
import type { TFunction } from 'i18next';

/** Every string `HostLinkChrome` shows, in the reader's language. */
export function hostLinkLabels(t: TFunction): Partial<HostLinkLabels> {
  return {
    status: {
      live: () => t('sessions.session.hostLink.status.live'),
      reconnecting: (host) => t('sessions.session.hostLink.status.reconnecting', { host }),
      offline: () => t('sessions.session.hostLink.status.offline'),
      'catching-up': (host) => t('sessions.session.hostLink.status.catchingUp', { host }),
      reconnected: () => t('sessions.session.hostLink.status.reconnected'),
    },
    title: {
      offline: (host) => t('sessions.session.hostLink.title.offline', { host }),
      'catching-up': () => t('sessions.session.hostLink.title.catchingUp'),
      reconnected: () => t('sessions.session.hostLink.title.reconnected'),
    },
    line: {
      offline: () => t('sessions.session.hostLink.line.offline'),
      'catching-up': (host) => t('sessions.session.hostLink.line.catchingUp', { host }),
      reconnected: () => t('sessions.session.hostLink.line.reconnected'),
    },
    fix: t('sessions.session.hostLink.fix'),
    fixIntro: (host) => t('sessions.session.hostLink.fixIntro', { host }),
  };
}
