import { createHash } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { ChatgptCredentialResolver } from '../../application/chatgpt-credential.resolver';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { CHATGPT_AUTH, PROVIDER_KEY_SEALER } from '../../bots.di-tokens';
import { ChatgptSignInMapper } from '../../chatgpt-sign-in.mapper';
import { BotErrors } from '../../domain/bots.errors';
import { type ChatgptLoginFlow, isChatgptLoginOpen } from '../../domain/chatgpt-login.policy';
import {
  type ChatgptAuthPort,
  ChatgptAuthRefusedError,
  type ChatgptDevicePoll,
} from '../../infrastructure/chatgpt-auth.port';
import type { ProviderKeySealerPort } from '../../infrastructure/provider-key-sealer.port';
import { PollChatgptLoginCommand } from './poll-chatgpt-login.command';

/**
 * One poll of a ChatGPT sign-in the console is waiting on: asks ChatGPT
 * whether the person approved the code, and when they did, stores the
 * sign-in's tokens as the workspace's ChatGPT credential. A sign-in that does
 * not open, lapsed, or was started in another workspace answers `BOTS_018`.
 * ChatGPT is asked at most once per interval it set for the code, whatever a
 * client polls at: a poll sooner than that answers "pending" without asking,
 * so no client can spend the client-wide budget every workspace signs in on.
 * The answer is whether it is stored, about this request alone.
 */
@CommandHandler(PollChatgptLoginCommand)
export class PollChatgptLoginCommandHandler
  implements ICommandHandler<PollChatgptLoginCommand, boolean>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(CHATGPT_AUTH) private readonly auth: ChatgptAuthPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    private readonly mapper: ChatgptSignInMapper,
    private readonly chatgpt: ChatgptCredentialResolver,
    private readonly cache: CacheService,
  ) {}

  async execute({ scope, flowId }: PollChatgptLoginCommand): Promise<boolean> {
    const organizationId = scope.organizationId;
    requireOrganization(organizationId);
    this.providers.assertConfigured();
    const flow = this.open(flowId);
    if (!flow || !isChatgptLoginOpen(flow, organizationId, new Date())) {
      throw new AppError(BotErrors.CHATGPT_LOGIN_EXPIRED);
    }
    if (!(await this.cache.setIfAbsent(this.paceKey(flow), 1, flow.intervalSeconds))) {
      return false;
    }
    let poll: ChatgptDevicePoll;
    try {
      poll = await this.auth.pollDeviceCode(flow);
    } catch (error) {
      if (error instanceof ChatgptAuthRefusedError) {
        throw new AppError(BotErrors.CHATGPT_LOGIN_EXPIRED, {
          detail: 'ChatGPT refused the sign-in',
        });
      }
      throw error;
    }
    if (poll.status === 'pending') return false;
    await this.chatgpt.connect(organizationId, scope.userId, poll.tokens);
    return true;
  }

  /** One key per device code, by digest: the code's id is a live credential while it lasts. */
  private paceKey(flow: ChatgptLoginFlow): string {
    const digest = createHash('sha256').update(flow.deviceAuthId).digest('hex').slice(0, 32);
    return `bots:chatgpt:poll:${digest}`;
  }

  /** The sign-in a `flowId` seals; null for one this server did not seal. */
  private open(flowId: string): ChatgptLoginFlow | null {
    try {
      return this.mapper.loginFlowOf(this.sealer.open(Buffer.from(flowId, 'base64url')));
    } catch {
      return null;
    }
  }
}
