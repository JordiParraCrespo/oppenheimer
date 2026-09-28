import auth from './en/auth.json';
import automations from './en/automations.json';
import common from './en/common.json';
import consent from './en/consent.json';
import emails from './en/emails.json';
import errors from './en/errors.json';
import hosts from './en/hosts.json';
import language from './en/language.json';
import nav from './en/nav.json';
import onboarding from './en/onboarding.json';
import projects from './en/projects.json';
import publicCopy from './en/public.json';
import sessions from './en/sessions.json';
import settings from './en/settings.json';
import theme from './en/theme.json';
import toasts from './en/toasts.json';
import validation from './en/validation.json';

/** Merged English catalog — the shape `t('auth.login')` reads. */
const en = {
  common,
  validation,
  errors,
  auth,
  nav,
  language,
  consent,
  onboarding,
  public: publicCopy,
  projects,
  sessions,
  automations,
  hosts,
  settings,
  theme,
  toasts,
  emails,
} as const;

export default en;
