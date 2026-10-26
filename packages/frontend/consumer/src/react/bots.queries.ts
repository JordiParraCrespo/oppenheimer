'use client';

import {
  shareEntities,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';
import {
  type QueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type BotDocumentEntity,
  type BotDocumentRevisionEntity,
  BotEntity,
  type BotGroupEntity,
  type BotMemoryFactEntity,
  type SaveBotDocumentInput,
  type UpdateBotInput,
} from '../modules/bots/bot.entity';
import { useConsumerApp } from './context';
import { useHostListQuery, useHostPresencePoll } from './hosts.queries';
import { seedDetails } from './seed-details';

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

/** The bots read: the key, and a fetch that fills each bot's detail. */
function useBotListQuery() {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return {
    queryKey: botsKeys.list(),
    queryFn: async () => {
      const askedAt = Date.now();
      const bots = await app.bots.findAll();
      seedDetails(queryClient, bots, botsKeys.detail, askedAt);
      return bots;
    },
  };
}

function useBotGroupListQuery() {
  const app = useConsumerApp();
  return { queryKey: botsKeys.groupList(), queryFn: () => app.bots.findGroups() };
}

/** The workspace's bots, ungrouped first, then by group and position. */
export function useBots<TData = BotEntity[]>(
  options?: Omit<UseQueryOptions<BotEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BotEntity[], Error, TData>({ ...useBotListQuery(), ...options });
}

/** The sidebar's groups, in their order: a picker that waits on nothing. */
export function useBotGroups<TData = BotGroupEntity[]>(
  options?: Omit<UseQueryOptions<BotGroupEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BotGroupEntity[], Error, TData>({ ...useBotGroupListQuery(), ...options });
}

/**
 * The Employees sidebar's two reads under a Suspense `QueryState`: the
 * groups and the bots in them, fetched side by side. `error` is the first
 * refetch that failed over data already drawn.
 */
export function useSuspenseBotsAndGroups() {
  const [bots, groups] = useSuspenseQueries({
    queries: [useBotListQuery(), useBotGroupListQuery()],
  });
  return { bots: bots.data, groups: groups.data, error: bots.error ?? groups.error };
}

/** One bot under a Suspense `QueryState`; `data` is always the bot. */
export function useSuspenseBot(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotEntity, Error>({
    queryKey: botsKeys.detail(id),
    queryFn: () => app.bots.findById(id),
  });
}

/**
 * Settings → Runs on's two reads under a Suspense `QueryState`, side by side:
 * the bot (its home host) and the caller's hosts, polling their presence
 * while the page is up so each one's dot stays true. `error` is the first
 * refetch that failed over data already drawn.
 */
export function useSuspenseBotAndHosts(id: string) {
  const app = useConsumerApp();
  const [bot, hosts] = useSuspenseQueries({
    queries: [
      { queryKey: botsKeys.detail(id), queryFn: () => app.bots.findById(id) },
      { ...useHostListQuery(), ...useHostPresencePoll(true) },
    ],
  });
  return { bot: bot.data, hosts: hosts.data, error: bot.error ?? hosts.error };
}

/** Both documents, soul first, for a reader that draws nothing while they load. */
export function useBotDocuments<TData = BotDocumentEntity[]>(
  id: string,
  options?: Omit<UseQueryOptions<BotDocumentEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<BotDocumentEntity[], Error, TData>({
    queryKey: botsKeys.documentList(id),
    queryFn: () => app.bots.findDocuments(id),
    ...options,
  });
}

/** Both documents under a Suspense `QueryState`. */
export function useSuspenseBotDocuments(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotDocumentEntity[], Error>({
    queryKey: botsKeys.documentList(id),
    queryFn: () => app.bots.findDocuments(id),
  });
}

/** One document's revisions, newest first, under a Suspense `QueryState`. */
export function useSuspenseBotRevisions(id: string, name: BotDocumentName) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotDocumentRevisionEntity[], Error>({
    queryKey: botsKeys.revisions(id, name),
    queryFn: () => app.bots.findRevisions(id, name),
  });
}

/** What a bot remembers, oldest first, under a Suspense `QueryState`. */
export function useSuspenseBotMemory(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotMemoryFactEntity[], Error>({
    queryKey: botsKeys.memoryList(id),
    queryFn: () => app.bots.findMemory(id),
  });
}

/** A row's place in a list, written over by the row the server answered with. */
function replaced<TRow extends { id: string }>(saved: TRow) {
  return (rows: TRow[]) => rows.map((row) => (row.id === saved.id ? saved : row));
}

/** A list without the row that is gone. */
function without<TRow extends { id: string }>(id: string) {
  return (rows: TRow[]) => rows.filter((row) => row.id !== id);
}

/**
 * A bot the server answered with: its detail, and its row in the list. A
 * move between groups or a new position reorders the others, so the list is
 * read again then; a new bot has no row yet, so the list is read again too.
 */
async function settleBot(queryClient: QueryClient, saved: BotEntity, reorders: boolean) {
  await queryClient.cancelQueries({ queryKey: botsKeys.detail(saved.id), exact: true });
  queryClient.setQueryData(botsKeys.detail(saved.id), saved);
  queryClient.setQueryData<BotEntity[]>(botsKeys.list(), (rows) =>
    rows?.map((row) => (row.id === saved.id ? shareEntities(row, saved) : row)),
  );
  if (reorders) await queryClient.invalidateQueries({ queryKey: botsKeys.lists() });
}

/**
 * A bot that is gone: its reads are dropped rather than left stale, so nothing
 * asks the API again for it, and its row leaves the list.
 */
function dropBot(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: botsKeys.detail(id) });
  queryClient.setQueryData<BotEntity[]>(
    botsKeys.list(),
    (rows) => rows && without<BotEntity>(id)(rows),
  );
}

/** The sidebar's groups, written in place; nothing when they were never read. */
function settleGroups(
  queryClient: QueryClient,
  update: (rows: BotGroupEntity[]) => BotGroupEntity[],
) {
  queryClient.setQueryData<BotGroupEntity[]>(botsKeys.groupList(), (rows) => rows && update(rows));
}

/** A document the server answered with, written into the pair, and its history read again. */
async function settleDocument(queryClient: QueryClient, id: string, saved: BotDocumentEntity) {
  queryClient.setQueryData<BotDocumentEntity[]>(botsKeys.documentList(id), (rows) =>
    rows?.map((row) => (row.name === saved.name ? saved : row)),
  );
  await queryClient.invalidateQueries({ queryKey: botsKeys.revisions(id, saved.name) });
}

/** What a bot remembers, written in place; nothing when it was never read. */
function settleFacts(
  queryClient: QueryClient,
  id: string,
  update: (rows: BotMemoryFactEntity[]) => BotMemoryFactEntity[],
) {
  queryClient.setQueryData<BotMemoryFactEntity[]>(
    botsKeys.memoryList(id),
    (rows) => rows && update(rows),
  );
}

/** A blank bot (a first name such as "Juno"), ungrouped. Open its chat with the answer. */
export function useCreateBot(options?: UseMutationOptions<BotEntity, Error, void>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => app.bots.create(),
    ...withCacheOnSuccess(options, (added) => settleBot(queryClient, added, true)),
  });
}

export interface UpdateBotVariables {
  id: string;
  input: UpdateBotInput;
}

/** Whether an update moves the bot among the others, so the list's order changes. */
function reorders(input: UpdateBotInput): boolean {
  return 'groupId' in input || 'position' in input;
}

/** Profile, the sidebar group, the home host, and the composer's model, effort and approval. */
export function useUpdateBot(options?: UseMutationOptions<BotEntity, Error, UpdateBotVariables>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateBotVariables) => app.bots.update(id, input),
    ...withCacheOnSuccess(options, (saved, { input }) =>
      settleBot(queryClient, saved, reorders(input)),
    ),
  });
}

/** `bot` with the fields `input` sets; a field it leaves out keeps the bot's. */
function withInput(bot: BotEntity, input: UpdateBotInput): BotEntity {
  const set = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.assign(Object.create(BotEntity.prototype), bot, Object.fromEntries(set));
}

/** What `bot` holds in each field `input` sets: the input that puts them back. */
function inputRestoring(bot: BotEntity, input: UpdateBotInput): UpdateBotInput {
  return Object.fromEntries(
    Object.keys(input).map((key) => [key, bot[key as keyof UpdateBotInput]]),
  );
}

interface UpdateBotContext {
  previous?: BotEntity;
}

/**
 * {@link useUpdateBot} for a pick that shows at once (the composer's chips):
 * the bot's detail takes the picked fields before the request goes. A refusal
 * puts back the fields this pick set, and only those, so a later pick still on
 * its way keeps showing; the server's answer replaces the guess either way.
 */
export function useUpdateBotOptimistically(
  options?: Omit<
    UseMutationOptions<BotEntity, Error, UpdateBotVariables, UpdateBotContext>,
    'onMutate'
  >,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateBotVariables) => app.bots.update(id, input),
    ...withCacheOnSuccess(options, (saved, { input }) =>
      settleBot(queryClient, saved, reorders(input)),
    ),
    onMutate: async ({ id, input }: UpdateBotVariables): Promise<UpdateBotContext> => {
      // Written before anything is awaited; cancelling first reverts a read on
      // its way, so it cannot land over the pick.
      const cancelled = queryClient.cancelQueries({ queryKey: botsKeys.detail(id), exact: true });
      const previous = queryClient.getQueryData<BotEntity>(botsKeys.detail(id));
      if (previous) queryClient.setQueryData(botsKeys.detail(id), withInput(previous, input));
      await cancelled;
      return { previous };
    },
    onError: (error, variables, context, mutation) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<BotEntity>(
          botsKeys.detail(variables.id),
          (current) => current && withInput(current, inputRestoring(previous, variables.input)),
        );
      }
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}

/** Delete: the bot, its documents and its memory. */
export function useDeleteBot(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.bots.remove(id),
    ...withCacheOnSuccess(options, (_data, id) => dropBot(queryClient, id)),
  });
}

/** A new group, first in the sidebar's list, as the API lists them. */
export function useCreateBotGroup(options?: UseMutationOptions<BotGroupEntity, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => app.bots.createGroup(name),
    ...withCacheOnSuccess(options, (added) =>
      settleGroups(queryClient, (rows) => [added, ...rows]),
    ),
  });
}

export interface RenameBotGroupVariables {
  id: string;
  name: string;
}

export function useRenameBotGroup(
  options?: UseMutationOptions<BotGroupEntity, Error, RenameBotGroupVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: RenameBotGroupVariables) => app.bots.renameGroup(id, name),
    ...withCacheOnSuccess(options, (saved) => settleGroups(queryClient, replaced(saved))),
  });
}

/** Its bots stay, ungrouped after the bots already there, so the bots are read again. */
export function useDeleteBotGroup(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.bots.removeGroup(id),
    ...withCacheOnSuccess(options, async (_data, id) => {
      settleGroups(queryClient, without(id));
      await queryClient.invalidateQueries({ queryKey: botsKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: botsKeys.details() });
    }),
  });
}

export interface SaveBotDocumentVariables {
  id: string;
  name: BotDocumentName;
  input: SaveBotDocumentInput;
}

/**
 * Save revision. A save over a revision somebody else saved since is refused
 * (`documentConflictRevision` reads the revision it is at), and the documents
 * are left as they are until the editor asks for them again.
 */
export function useSaveBotDocument(
  options?: UseMutationOptions<BotDocumentEntity, Error, SaveBotDocumentVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, input }: SaveBotDocumentVariables) =>
      app.bots.saveDocument(id, name, input),
    ...withCacheOnSuccess(options, (saved, { id }) => settleDocument(queryClient, id, saved)),
  });
}

export interface RevertBotDocumentVariables {
  id: string;
  name: BotDocumentName;
  revision: number;
}

export function useRevertBotDocument(
  options?: UseMutationOptions<BotDocumentEntity, Error, RevertBotDocumentVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, revision }: RevertBotDocumentVariables) =>
      app.bots.revert(id, name, revision),
    ...withCacheOnSuccess(options, (saved, { id }) => settleDocument(queryClient, id, saved)),
  });
}

/** The editor's Reload after a conflict: the pair as it is now, and its histories. */
export function useReloadBotDocuments() {
  const queryClient = useQueryClient();
  return (id: string) => queryClient.invalidateQueries({ queryKey: botsKeys.documents(id) });
}

export interface AddBotFactVariables {
  id: string;
  content: string;
}

export function useAddBotFact(
  options?: UseMutationOptions<BotMemoryFactEntity, Error, AddBotFactVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: AddBotFactVariables) => app.bots.addFact(id, content),
    ...withCacheOnSuccess(options, (added, { id }) =>
      settleFacts(queryClient, id, (rows) => [...rows, added]),
    ),
  });
}

export interface UpdateBotFactVariables {
  id: string;
  factId: string;
  content: string;
}

export function useUpdateBotFact(
  options?: UseMutationOptions<BotMemoryFactEntity, Error, UpdateBotFactVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, factId, content }: UpdateBotFactVariables) =>
      app.bots.updateFact(id, factId, content),
    ...withCacheOnSuccess(options, (saved, { id }) =>
      settleFacts(queryClient, id, replaced(saved)),
    ),
  });
}

export interface DeleteBotFactVariables {
  id: string;
  factId: string;
}

export function useDeleteBotFact(
  options?: UseMutationOptions<void, Error, DeleteBotFactVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, factId }: DeleteBotFactVariables) => app.bots.removeFact(id, factId),
    ...withCacheOnSuccess(options, (_data, { id, factId }) =>
      settleFacts(queryClient, id, without(factId)),
    ),
  });
}

/** Forget everything: the bot keeps its soul and instructions. */
export function useClearBotMemory(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.bots.clearMemory(id),
    ...withCacheOnSuccess(options, (_data, id) =>
      queryClient.setQueryData<BotMemoryFactEntity[]>(botsKeys.memoryList(id), []),
    ),
  });
}
