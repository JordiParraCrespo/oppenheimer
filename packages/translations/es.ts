import auth from './es/auth.json';
import automations from './es/automations.json';
import calendar from './es/calendar.json';
import common from './es/common.json';
import consent from './es/consent.json';
import emails from './es/emails.json';
import errors from './es/errors.json';
import hosts from './es/hosts.json';
import language from './es/language.json';
import nav from './es/nav.json';
import onboarding from './es/onboarding.json';
import projects from './es/projects.json';
import publicCopy from './es/public.json';
import pullRequests from './es/pullRequests.json';
import sessions from './es/sessions.json';
import settings from './es/settings.json';
import tasks from './es/tasks.json';
import theme from './es/theme.json';
import toasts from './es/toasts.json';
import validation from './es/validation.json';

const es = {
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
  pullRequests,
  tasks,
  calendar,
  hosts,
  settings,
  theme,
  toasts,
  emails,
} as const;

export default es;
