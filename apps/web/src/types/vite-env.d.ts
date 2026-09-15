/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. Empty means same-origin (the dev server proxies `/api`). */
  readonly VITE_API_URL?: string;
  /** PostHog project key. Unset disables analytics entirely. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog host. Defaults to the EU cloud region. */
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** App version, injected by Vite from `package.json`. */
declare const __APP_VERSION__: string;
