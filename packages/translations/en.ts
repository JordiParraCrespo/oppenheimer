import auth from './en/auth.json';
import common from './en/common.json';
import consent from './en/consent.json';
import control from './en/control.json';
import emails from './en/emails.json';
import errors from './en/errors.json';
import home from './en/home.json';
import hosts from './en/hosts.json';
import language from './en/language.json';
import nav from './en/nav.json';
import onboarding from './en/onboarding.json';
import pages from './en/pages.json';
import publicCopy from './en/public.json';
import sessions from './en/sessions.json';
import table from './en/table.json';
import theme from './en/theme.json';
import toasts from './en/toasts.json';
import validation from './en/validation.json';

/** Merged English catalog — the shape `t('auth.login')` reads. */
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
  sessions,
  hosts,
  table,
  theme,
  toasts,
  emails,
} as const;

export default en;
