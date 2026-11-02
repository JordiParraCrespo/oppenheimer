import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { MemberProblemResponses } from '../../decorators/member-problem-responses.decorator';
import { MemberResponseDto } from '../../dtos/organization.response.dto';
import { FindMemberQuery } from '../../queries/find-member/find-member.query';
import { AddMemberCommand } from './add-member.command';
import { AddMemberRequest } from './add-member.request.dto';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@MemberProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class AddMemberHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':orgId/members')
  @Version('1')
  @RequireScopes('members:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'create', subject: 'Member' })
  @ApiOperation({ summary: 'Add an existing user as a member' })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  async add(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: AddMemberRequest,
  ): Promise<MemberResponseDto> {
    const memberId = await this.commandBus.execute<AddMemberCommand, AggregateID>(
      new AddMemberCommand({ headers: req.headers, organizationId: orgId, input: body }),
    );
    return this.queryBus.execute<FindMemberQuery, MemberResponseDto>(
      new FindMemberQuery({ organizationId: orgId, memberId }),
    );
  }
}
