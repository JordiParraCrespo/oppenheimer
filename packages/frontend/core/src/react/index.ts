export {
  type CaptureEventVariables,
  /** @public The documented way to capture a product event (`apps/docs/docs/architecture/analytics.md`). */
  useCaptureEvent,
  /** @public The documented way to capture a "was shown" event (`apps/docs/docs/architecture/analytics.md`). */
  useCaptureOnMount,
  usePageView,
} from './analytics.queries';
export {
  type SocialLoginVariables,
  useExpireSession,
  useForgotPassword,
  useLogin,
  useLogout,
  useResetPassword,
  useSessionRestore,
  useSocialLogin,
} from './auth.queries';
export { useDeploymentCapabilities } from './capabilities.queries';
export { OppenheimerProvider, useOppenheimerApp } from './context';
export { type ResolvedErrorMessage, useErrorMessage } from './error-message';
export {
  type FeatureFlagReadOptions,
  /** @public The flags rule's client read (`.agents/rules/feature-flags.md`). */
  useFeatureFlag,
  /** @public The flags rule's read that waits for the answer (`.agents/rules/feature-flags.md`). */
  useFeatureFlags,
  /** @public The flags rule's read of a variant flag (`.agents/rules/feature-flags.md`). */
  useFeatureFlagValue,
} from './feature-flags.queries';
export { useAuthState } from './hooks';
export { type LastFailure, lastFailure, type TrackedMutation } from './last-failure';
export { refetchEverythingForNewIdentity, withCacheOnSuccess } from './mutations';
export {
  createQueryPersistOptions,
  defaultQueryClientOptions,
  type QueryPersistConfig,
} from './persistence';
export { useQueries, useQuery } from './query';
export {
  createQueryClient,
  type SessionExpiryTarget,
} from './query-client';
export { shareEntities } from './share-entities';
export { useUserSettings } from './user-settings.queries';
export {
  useMyPermissions,
  useProfile,
  usersKeys,
} from './users.queries';
