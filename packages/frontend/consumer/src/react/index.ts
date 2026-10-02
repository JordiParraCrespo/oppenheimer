export { useRegister } from './auth.queries';
export {
  type PauseAutomationVariables,
  type RunAutomationVariables,
  type UpdateAutomationVariables,
  useAutomation,
  useAutomationRuns,
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useRunHistory,
  useSetAutomationPaused,
  useTriggerPreview,
  useUpdateAutomation,
} from './automations.queries';
// The pairing flow, not its parts: a surface that read the token or the host
// poll directly would be back to asking "is there a host?" instead of "was
// this token spent?".
export { type HostPairingFlow, useHostPairing } from './hosts.pairing';
export {
  useHostPresence,
  useHosts,
  useHostsSnapshot,
  useRemoveHost,
  useRenameHost,
} from './hosts.queries';
export {
  type ConnectInstallationVariables,
  useConnectInstallation,
  useInstallationRepositories,
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
  useStartInstallation,
} from './installations.queries';
export {
  type ClaimPersonalWorkspaceVariables,
  useCheckSlug,
  useClaimPersonalWorkspace,
  useOrganizations,
} from './organizations.queries';
export { usePermissionCatalog } from './permissions.queries';
export { CONSUMER_NON_PERSISTED_FEATURES } from './persistence';
export {
  useChangeEmail,
  useChangeOwnPassword,
  useDeleteAccount,
  useDeleteAvatar,
  useMyProfile,
  useProfileSessions,
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
  useUpdateMyProfile,
  useUploadAvatar,
} from './profile.queries';
export {
  type UpdateProjectVariables,
  useArchiveProject,
  useCreateProject,
  useProjects,
  useProjectsSnapshot,
  useUpdateProject,
} from './projects.queries';
export {
  type CloseSessionVariables,
  type CreateSessionVariables,
  type MoveSessionVariables,
  type RenameSessionVariables,
  useCloseSession,
  useCreateSession,
  useInvalidateSession,
  useMoveSession,
  usePasteSessionImage,
  usePrepareSession,
  useRenameSession,
  useRestartSession,
  useSession,
  useSessionStartProgress,
  useSessions,
  useUploadSessionAttachment,
} from './sessions.queries';
export { useSessionStream } from './sessions.stream';
