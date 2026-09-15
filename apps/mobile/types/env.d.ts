declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_MOBILE_SCHEME?: string;
    EXPO_PUBLIC_POSTHOG_KEY?: string;
    EXPO_PUBLIC_POSTHOG_HOST?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
    EXPO_PUBLIC_REVENUECAT_IOS_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?: string;
    EXPO_PUBLIC_CONFIG_URL?: string;
    SENTRY_ORG?: string;
    SENTRY_PROJECT?: string;
  }
}
