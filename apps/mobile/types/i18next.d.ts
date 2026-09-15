import type { Messages } from '@oppenheimer/translations';
import 'i18next';

// Gives `t()` and <Trans> full type-safety / autocompletion over our keys.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: Messages;
    };
  }
}
