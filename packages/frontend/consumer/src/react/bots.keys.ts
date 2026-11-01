'use client';

import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';

/**
 * Query key factory for the `bots` feature. A bot's documents and memory hang
 * under its detail, each with its own `list` leaf, so removing a bot drops its
 * whole subtree and saving a document does not refetch its revisions' prefix
 * siblings.
 */
export const botsKeys = {
  all: ['bots'] as const,
  lists: () => [...botsKeys.all, 'list'] as const,
  list: () => [...botsKeys.lists()] as const,
  details: () => [...botsKeys.all, 'detail'] as const,
  detail: (id: string) => [...botsKeys.details(), id] as const,
  documents: (id: string) => [...botsKeys.detail(id), 'documents'] as const,
  documentList: (id: string) => [...botsKeys.documents(id), 'list'] as const,
  revisions: (id: string, name: BotDocumentName) =>
    [...botsKeys.documents(id), name, 'revisions'] as const,
  memory: (id: string) => [...botsKeys.detail(id), 'memory'] as const,
  memoryList: (id: string) => [...botsKeys.memory(id), 'list'] as const,
  skills: (id: string) => [...botsKeys.detail(id), 'skills'] as const,
  skillList: (id: string) => [...botsKeys.skills(id), 'list'] as const,
  permissions: (id: string) => [...botsKeys.detail(id), 'permissions'] as const,
  goal: (id: string) => [...botsKeys.detail(id), 'goal'] as const,
  routines: (id: string) => [...botsKeys.detail(id), 'routines'] as const,
  routineList: (id: string) => [...botsKeys.routines(id), 'list'] as const,
  // Every bot's, for `/automations`: apart from any one bot's, so a write to
  // one routine refreshes both by name.
  allRoutines: () => [...botsKeys.all, 'routine', 'list'] as const,
  conversation: (id: string) => [...botsKeys.detail(id), 'conversation'] as const,
  image: (id: string, attachmentId: string) =>
    [...botsKeys.detail(id), 'image', attachmentId] as const,
  approvals: (id: string) => [...botsKeys.detail(id), 'approvals'] as const,
  pendingApproval: (id: string) => [...botsKeys.approvals(id), 'pending'] as const,
  // The card of questions the bot waits on (`ask_user`).
  pendingQuestion: (id: string) => [...botsKeys.detail(id), 'question'] as const,
  // The workspace's approvals across its bots (the Inbox): apart from any one
  // bot's, and announced by `botApproval.changed`.
  workspaceApprovals: () => [...botsKeys.all, 'approvals'] as const,
  pendingApprovals: () => [...botsKeys.workspaceApprovals(), 'pending'] as const,
  groups: () => [...botsKeys.all, 'group'] as const,
  groupLists: () => [...botsKeys.groups(), 'list'] as const,
  groupList: () => [...botsKeys.groupLists()] as const,
  providers: () => [...botsKeys.all, 'provider'] as const,
  providerList: () => [...botsKeys.providers(), 'list'] as const,
  // Apart from `providers()`: a sign-in that lands refreshes the list, and must
  // not mint itself a new code doing so.
  chatgptLogins: () => [...botsKeys.all, 'chatgpt-login'] as const,
  chatgptLogin: () => [...botsKeys.chatgptLogins(), 'current'] as const,
  chatgptLoginStatus: (flowId: string | undefined) =>
    [...botsKeys.chatgptLogins(), 'status', flowId] as const,
};
