import apiTokens from './en/apiTokens.json';
import auth from './en/auth.json';
import common from './en/common.json';
import consent from './en/consent.json';
import control from './en/control.json';
import dashboard from './en/dashboard.json';
import emails from './en/emails.json';
import errors from './en/errors.json';
import home from './en/home.json';
import language from './en/language.json';
import nav from './en/nav.json';
import onboarding from './en/onboarding.json';
import pages from './en/pages.json';
import profile from './en/profile.json';
import publicCopy from './en/public.json';
import settings from './en/settings.json';
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
  dashboard,
  home,
  nav,
  control,
  language,
  apiTokens,
  consent,
  onboarding,
  pages,
  profile,
  public: publicCopy,
  settings,
  table,
  theme,
  toasts,
  emails,
} as const;

export default en;
