export {
  type CaptureEventVariables,
  /** @public The way to capture a product event. */
  useCaptureEvent,
  /** @public The way to capture a "was shown" event. */
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
export { useCaptureError, useReportError } from './error-reporting.hooks';
export {
  type FeatureFlagReadOptions,
  /** @public Whether a boolean flag is on, read on the client. */
  useFeatureFlag,
  /** @public The flags with their loading state, for a render that waits for the answer. */
  useFeatureFlags,
  /** @public A flag's value, the read for a variant flag. */
  useFeatureFlagValue,
} from './feature-flags.queries';
export { useAuthState } from './hooks';
export { type LastFailure, lastFailure, type TrackedMutation } from './last-failure';
export {
  defineMutation,
  type HookMutationOptions,
  type MutationSpec,
  refetchEverythingForNewIdentity,
  withCacheOnSuccess,
} from './mutations';
export { PERSIST_META, type QueryPersistMeta } from './persist-meta';
export {
  createQueryPersistOptions,
  defaultQueryClientOptions,
  type QueryPersistConfig,
} from './persistence';
export { useQueries, useQuery, useSuspenseQueries, useSuspenseQuery } from './query';
export {
  createQueryClient,
  type SessionExpiryTarget,
} from './query-client';
export { useSuspenseApiVersion } from './release.queries';
export { shareEntities } from './share-entities';
export { useUserSettings } from './user-settings.queries';
export {
  useMyPermissions,
  useProfile,
  usersKeys,
} from './users.queries';
