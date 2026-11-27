import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { AutomationMapper } from '../../automation.mapper';
import { IssuedRoutineWebhookResponseDto } from '../../dtos/routine-webhook.response.dto';
import { IssueRoutineWebhookCommand } from './issue-routine-webhook.command';
import type { IssuedWebhook } from './issue-routine-webhook.command-handler';
import { IssueRoutineWebhookRequest } from './issue-routine-webhook.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class IssueRoutineWebhookHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: AutomationMapper,
    private readonly configService: ConfigService,
  ) {}

  @Post(':id/routines/:routineId/webhook')
  @Version('1')
  @HttpCode(201)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Issue a routine’s webhook URL',
    description:
      'A new URL for a routine that has a webhook trigger, replacing the one it had, which stops working at once. With `signed`, also a new signing secret every request must be signed with. The URL and the secret are answered this once; only the start of the token is shown afterwards.',
  })
  @ApiResponse({ status: 201, type: IssuedRoutineWebhookResponseDto })
  @ApiProblemResponse({
    status: 403,
    description: 'The caller’s email address is not verified',
    code: 'TOKEN_010',
  })
  @ApiProblemResponse({ status: 404, description: 'Routine not found', code: 'AUTOMATIONS_001' })
  @ApiProblemResponse({
    status: 422,
    description: 'The routine has no webhook trigger',
    code: 'AUTOMATIONS_014',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Signing is not configured',
    code: 'AUTOMATIONS_015',
  })
  async issue(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('routineId', new ParseUUIDPipe()) routineId: string,
    @Body() body: IssueRoutineWebhookRequest,
  ): Promise<IssuedRoutineWebhookResponseDto> {
    const issued = await this.commandBus.execute<IssueRoutineWebhookCommand, IssuedWebhook>(
      new IssueRoutineWebhookCommand({ scope, botId, routineId, signed: body.signed }),
    );
    return this.mapper.issuedWebhookToResponse(
      issued.view,
      this.configService.get<string>('app.betterAuthUrl') ?? '',
      issued.token,
      issued.signingSecret,
    );
  }
}
