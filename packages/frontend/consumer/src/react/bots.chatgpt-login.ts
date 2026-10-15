'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import { skipToken, useQueryClient } from '@tanstack/react-query';
import {
  type ChatgptLoginEntity,
  type ChatgptLoginState,
  isChatgptLoginExpired,
} from '../modules/bots/bot.entity';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';

/** What a surface running the ChatGPT sign-in is showing. */
export interface ChatgptLoginFlow {
  /** The code to type and where; undefined while it is being asked for. */
  login: ChatgptLoginEntity | undefined;
  /** `connected` once the sign-in is stored, `expired` once the code can sign nothing in. */
  state: ChatgptLoginState;
  isStarting: boolean;
  /** Asking for the code failed, or a poll did for a reason other than the code lapsing. */
  error: Error | null;
  /** A fresh code, for one that lapsed or was refused. */
  restart: () => void;
}

/**
 * The ChatGPT sign-in (`product/versions/mvp/25-bots.md` §2): one device
 * code, and a poll of it until the person approves it on OpenAI's page.
 *
 * Reading the current sign-in is what asks for the code, as reading the
 * current pairing token mints it, so `enabled: false` keeps the flow idle.
 * The code is never refetched on its own (a refetch would replace the one on
 * screen); `restart` asks for the next. The poll stops on `connected`, which
 * re-reads the providers list, and on `expired` (`BOTS_018`).
 */
export function useChatgptLogin({ enabled = true }: { enabled?: boolean } = {}): ChatgptLoginFlow {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const start = useQuery<ChatgptLoginEntity, Error>({
    queryKey: botsKeys.chatgptLogin(),
    queryFn: enabled ? () => app.bots.startChatgptLogin() : skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const login = start.data;
  const statusKey = botsKeys.chatgptLoginStatus(login?.flowId);
  const poll = useQuery<ChatgptLoginState, Error>({
    queryKey: statusKey,
    queryFn: login
      ? async () => {
          try {
            const state = await app.bots.pollChatgptLogin(login.flowId);
            if (state === 'connected') {
              await queryClient.invalidateQueries({ queryKey: botsKeys.providers() });
            }
            return state;
          } catch (error) {
            if (isChatgptLoginExpired(error)) return 'expired';
            throw error;
          }
        }
      : skipToken,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    ...usePollWhile<ChatgptLoginState>(
      'chatgptLogin',
      statusKey,
      (state) => state !== 'connected' && state !== 'expired',
    ),
  });

  return {
    login,
    state: poll.data ?? 'pending',
    isStarting: start.isFetching,
    error: start.error ?? poll.error ?? null,
    // Resetting the current sign-in asks for a new code; the old code's poll is keyed by it and stops.
    restart: () => void queryClient.resetQueries({ queryKey: botsKeys.chatgptLogins() }),
  };
}
