import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { DeleteModelProviderKeyCommand } from './delete-model-provider-key.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class DeleteModelProviderKeyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':provider/keys/:keyId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Forget one of a model provider's keys",
    description:
      "The provider's other keys stay. With none left, its bots cannot answer until a key is stored again.",
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
    @Param('keyId', new ParseUUIDPipe()) keyId: string,
  ): Promise<void> {
    await this.commandBus.execute<DeleteModelProviderKeyCommand, void>(
      new DeleteModelProviderKeyCommand({ scope, provider, keyId }),
    );
  }
}
