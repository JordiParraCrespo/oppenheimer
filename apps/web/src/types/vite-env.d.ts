/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. Empty means same-origin (the dev server proxies `/api`). */
  readonly VITE_API_URL?: string;
  /** PostHog project key. Unset disables analytics entirely. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog host. Defaults to the EU cloud region. */
  readonly VITE_POSTHOG_HOST?: string;
  /** Sentry DSN of the console's project. Unset disables error reporting entirely. */
  readonly VITE_SENTRY_DSN?: string;
  /** What Sentry files the console's events under. Defaults to Vite's mode. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The release the console's events name. Defaults to the package version. */
  readonly VITE_SENTRY_RELEASE?: string;
  /** Share of page loads and navigations traced, 0 to 1. Default 0. */
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** App version, injected by Vite from `package.json`. */
declare const __APP_VERSION__: string;
