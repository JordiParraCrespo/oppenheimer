'use client';

import {
  shareEntities,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import type { BotDocumentName, BotSection } from '@oppenheimer/shared/schemas/bot';
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
  type UpdateBotFactInput,
  type UpdateBotInput,
} from '../modules/bots/bot.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { useHostListQuery, useHostPresencePoll } from './hosts.queries';
import { mutation } from './mutation';
import { seedDetails } from './seed-details';

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

/** The workspace's bots in the Employees order: by group, then Ungrouped, each by position. */
export function useBots<TData = BotEntity[]>(
  options?: Omit<UseQueryOptions<BotEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BotEntity[], Error, TData>({ ...useBotListQuery(), ...options });
}

/**
 * The bots as last read, for a handler that needs every one without
 * subscribing to the list (a section's drag, which draws only its own).
 */
export function useBotsSnapshot(): () => BotEntity[] | undefined {
  const queryClient = useQueryClient();
  return () => queryClient.getQueryData<BotEntity[]>(botsKeys.list());
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

/**
 * The bots one console section lists beside Employees
 * (`28-bots-in-sections.md`), in the Employees order, under a Suspense
 * `QueryState`. It narrows the one bots read, so a chat that moves a bot's
 * last line moves it here too; `error` is a refetch that failed over data
 * already drawn.
 */
export function useSuspenseSectionBots(section: BotSection) {
  return useSuspenseQuery<BotEntity[], Error, BotEntity[]>({
    ...useBotListQuery(),
    select: (bots) => bots.filter((bot) => bot.sections.includes(section)),
  });
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

/**
 * A fact about the person is read by every bot of theirs (`25-bots.md`
 * §4.1), so a change to one, or a move in or out of that scope, refreshes
 * every bot's memory that was read, not only the bot that keeps it.
 */
function refreshSharedMemory(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: botsKeys.details(),
    predicate: (query) => query.queryKey[3] === 'memory',
  });
}

/** Whether a fact this bot's list holds is about the person, so its siblings read it too. */
function isSharedFact(queryClient: QueryClient, id: string, factId: string): boolean {
  const rows = queryClient.getQueryData<BotMemoryFactEntity[]>(botsKeys.memoryList(id));
  return rows?.find((row) => row.id === factId)?.scope === 'person';
}

/** A blank bot (a first name such as "Juno"), ungrouped. Open its chat with the answer. */
/** A blank bot; the variables are the sections it shows in, none when left out. */
export const useCreateBot = mutation<BotEntity, BotSection[] | undefined>({
  run: (app, sections) => app.bots.create(sections),
  update: (queryClient, added) => settleBot(queryClient, added, true),
});

export interface UpdateBotVariables {
  id: string;
  input: UpdateBotInput;
}

/** Whether an update moves the bot among the others, so the list's order changes. */
function reorders(input: UpdateBotInput): boolean {
  return 'groupId' in input || 'position' in input;
}

/** Profile, the sidebar group, the home host, and the composer's model, effort and approval. */
export const useUpdateBot = mutation<BotEntity, UpdateBotVariables>({
  run: (app, { id, input }) => app.bots.update(id, input),
  update: (queryClient, saved, { input }) => settleBot(queryClient, saved, reorders(input)),
});

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
export const useDeleteBot = mutation<void, string>({
  run: (app, id) => app.bots.remove(id),
  update: (queryClient, _data, id) => dropBot(queryClient, id),
});

/** A new group, first in the sidebar's list, as the API lists them. */
export const useCreateBotGroup = mutation<BotGroupEntity, string>({
  run: (app, name) => app.bots.createGroup(name),
  update: (queryClient, added) => settleGroups(queryClient, (rows) => [added, ...rows]),
});

export interface RenameBotGroupVariables {
  id: string;
  name: string;
}

export const useRenameBotGroup = mutation<BotGroupEntity, RenameBotGroupVariables>({
  run: (app, { id, name }) => app.bots.renameGroup(id, name),
  update: (queryClient, saved) => settleGroups(queryClient, replaced(saved)),
});

/** Its bots stay, ungrouped after the bots already there, so the bots are read again. */
export const useDeleteBotGroup = mutation<void, string>({
  run: (app, id) => app.bots.removeGroup(id),
  update: async (queryClient, _data, id) => {
    settleGroups(queryClient, without(id));
    await queryClient.invalidateQueries({ queryKey: botsKeys.lists() });
    await queryClient.invalidateQueries({ queryKey: botsKeys.details() });
  },
});

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
export const useSaveBotDocument = mutation<BotDocumentEntity, SaveBotDocumentVariables>({
  run: (app, { id, name, input }) => app.bots.saveDocument(id, name, input),
  update: (queryClient, saved, { id }) => settleDocument(queryClient, id, saved),
});

export interface RevertBotDocumentVariables {
  id: string;
  name: BotDocumentName;
  revision: number;
}

export const useRevertBotDocument = mutation<BotDocumentEntity, RevertBotDocumentVariables>({
  run: (app, { id, name, revision }) => app.bots.revert(id, name, revision),
  update: (queryClient, saved, { id }) => settleDocument(queryClient, id, saved),
});

/** The editor's Reload after a conflict: the pair as it is now, and its histories. */
export function useReloadBotDocuments() {
  const queryClient = useQueryClient();
  return (id: string) => queryClient.invalidateQueries({ queryKey: botsKeys.documents(id) });
}

export interface AddBotFactVariables {
  id: string;
  content: string;
}

export const useAddBotFact = mutation<BotMemoryFactEntity, AddBotFactVariables>({
  run: (app, { id, content }) => app.bots.addFact(id, content),
  update: (queryClient, added, { id }) => settleFacts(queryClient, id, (rows) => [...rows, added]),
});

export interface UpdateBotFactVariables extends UpdateBotFactInput {
  id: string;
  factId: string;
}

export const useUpdateBotFact = mutation<BotMemoryFactEntity, UpdateBotFactVariables>({
  run: (app, { id, factId, ...change }) => app.bots.updateFact(id, factId, change),
  update: (queryClient, saved, { id, scope }) => {
    settleFacts(queryClient, id, replaced(saved));
    return saved.scope === 'person' || scope ? refreshSharedMemory(queryClient) : undefined;
  },
});

export interface DeleteBotFactVariables {
  id: string;
  factId: string;
}

export const useDeleteBotFact = mutation<void, DeleteBotFactVariables>({
  run: (app, { id, factId }) => app.bots.removeFact(id, factId),
  update: (queryClient, _data, { id, factId }) => {
    const shared = isSharedFact(queryClient, id, factId);
    settleFacts(queryClient, id, without(factId));
    return shared ? refreshSharedMemory(queryClient) : undefined;
  },
});

/** Forget everything: the bot keeps its soul and instructions. */
export const useClearBotMemory = mutation<void, string>({
  run: (app, id) => app.bots.clearMemory(id),
  update: (queryClient, _data, id) => {
    const shared = queryClient
      .getQueryData<BotMemoryFactEntity[]>(botsKeys.memoryList(id))
      ?.some((row) => row.scope === 'person' && row.botId === id);
    queryClient.setQueryData<BotMemoryFactEntity[]>(botsKeys.memoryList(id), []);
    return shared ? refreshSharedMemory(queryClient) : undefined;
  },
});
