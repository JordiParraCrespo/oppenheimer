import auth from './en/auth.json';
import automations from './en/automations.json';
import common from './en/common.json';
import consent from './en/consent.json';
import control from './en/control.json';
import errors from './en/errors.json';
import home from './en/home.json';
import hosts from './en/hosts.json';
import language from './en/language.json';
import nav from './en/nav.json';
import onboarding from './en/onboarding.json';
import pages from './en/pages.json';
import projects from './en/projects.json';
import publicCopy from './en/public.json';
import sessions from './en/sessions.json';
import settings from './en/settings.json';
import theme from './en/theme.json';
import toasts from './en/toasts.json';
import validation from './en/validation.json';
import type { Messages } from './locales';

/**
 * The English catalog a browser bundles: every namespace but `emails`, which
 * only the API's email templates read.
 *
 * The web app ships English in its entry chunk (it is the fallback every other
 * locale resolves against), so a namespace no screen reads is weight every
 * first visit pays for — 1.7KB gzipped for `emails`. The type fails the build
 * when a namespace is added to `en.ts` and not here.
 */
const en = {
  common,
  validation,
  errors,
  auth,
  home,
  nav,
  control,
  language,
  consent,
  onboarding,
  pages,
  public: publicCopy,
  projects,
  sessions,
  automations,
  hosts,
  settings,
  theme,
  toasts,
} as const satisfies Omit<Messages, 'emails'>;

export default en;
