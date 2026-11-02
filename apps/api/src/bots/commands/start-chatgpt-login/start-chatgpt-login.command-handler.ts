import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { CHATGPT_AUTH, PROVIDER_KEY_SEALER } from '../../bots.di-tokens';
import { ChatgptSignInMapper } from '../../chatgpt-sign-in.mapper';
import { chatgptLoginExpiry } from '../../domain/chatgpt-login.policy';
import type { ChatgptLoginResponseDto } from '../../dtos/chatgpt-login.response.dto';
import type { ChatgptAuthPort } from '../../infrastructure/chatgpt-auth.port';
import type { ProviderKeySealerPort } from '../../infrastructure/provider-key-sealer.port';
import { StartChatgptLoginCommand } from './start-chatgpt-login.command';

/**
 * Settings → Model providers → Connect ChatGPT: asks ChatGPT for a device
 * code and hands the console the code to show and the sign-in to poll with.
 * Nothing is stored: the sign-in travels sealed, with the workspace it was
 * started for and when it lapses, and comes back on every poll. What comes
 * back is about this request alone, so the command answers it, not an id.
 */
@CommandHandler(StartChatgptLoginCommand)
export class StartChatgptLoginCommandHandler
  implements ICommandHandler<StartChatgptLoginCommand, ChatgptLoginResponseDto>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(CHATGPT_AUTH) private readonly auth: ChatgptAuthPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    private readonly mapper: ChatgptSignInMapper,
  ) {}

  async execute({ scope }: StartChatgptLoginCommand): Promise<ChatgptLoginResponseDto> {
    requireTenant(scope);
    this.providers.assertConfigured();
    const code = await this.auth.requestDeviceCode();
    const expiresAt = chatgptLoginExpiry(new Date());
    const flow = this.mapper.toLoginFlow({
      deviceAuthId: code.deviceAuthId,
      userCode: code.userCode,
      organizationId: scope.organizationId,
      expiresAt,
      intervalSeconds: code.intervalSeconds,
    });
    const flowId = this.sealer.seal(flow).toString('base64url');
    return this.mapper.toLoginResponse(flowId, code, expiresAt);
  }
}
