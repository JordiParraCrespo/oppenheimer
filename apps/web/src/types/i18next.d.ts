import type { Messages } from '@oppenheimer/translations/locales';
import 'i18next';

// The kit's augmentation (`packages/frontend/web/src/types/i18next.d.ts`), for this program.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: Messages;
    };
  }
}
