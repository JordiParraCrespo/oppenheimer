import {
  Controller,
  Inject,
  type MessageEvent,
  Req,
  Sse,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, AppError } from '@oppenheimer/backend-core';
import {
  WORKSPACE_STREAM_EVENT,
  WORKSPACE_STREAM_READY,
} from '@oppenheimer/shared/workspace-events';
import { map, type Observable } from 'rxjs';
import type { AbilityPort, AbilityRequest } from '../../../auth/application/ability.port';
import { ABILITY } from '../../../auth/auth.di-tokens';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import { AuthErrors } from '../../../auth/domain/auth.errors';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { readableTypes } from '../../application/workspace-event-access.policy';
import { StreamWorkspaceEventsQuery } from './stream-workspace-events.query';
import type { WorkspaceStreamFrame } from './stream-workspace-events.query-handler';

@ApiTags('Workspace events')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('events')
export class StreamWorkspaceEventsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(ABILITY)
    private readonly abilities: AbilityPort,
  ) {}

  @Sse()
  @Version('1')
  @NoPolicy(
    'open to a caller who may read any kind of change it carries; each kind is filtered by what the caller may read',
  )
  @AllowAnyScope()
  @RequireFlag('workspace_event_stream')
  @ApiOperation({
    summary: 'Stream what changes in the caller’s workspace',
    description:
      'Server-Sent Events. A `ready` event once the stream is subscribed, then one `change` event per change the caller may read, whose data is `{ type, id, … }` (`@oppenheimer/shared/workspace-events`): an invalidation, never the row, so the client re-reads it through its own endpoint. A `keepalive` event keeps an idle stream under proxy timeouts, and the API ends a stream after a while so the redial is authenticated again.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({ status: 200, description: 'The event stream' })
  async stream(
    @Req() request: AbilityRequest,
    @CurrentAccessScope() scope: AccessScope,
    @CurrentScope() credential: ScopeContext | null,
  ): Promise<Observable<MessageEvent>> {
    const types = readableTypes(await this.abilities.forRequest(request), credential);
    if (types.size === 0) throw new AppError(AuthErrors.FORBIDDEN);

    const frames = await this.queryBus.execute<
      StreamWorkspaceEventsQuery,
      Observable<WorkspaceStreamFrame>
    >(
      new StreamWorkspaceEventsQuery({
        userId: scope.userId,
        organizationId: scope.organizationId,
        types,
      }),
    );
    return frames.pipe(
      map((frame): MessageEvent => {
        switch (frame.kind) {
          case 'ready':
            return { type: WORKSPACE_STREAM_READY, data: '' };
          case 'change':
            return { type: WORKSPACE_STREAM_EVENT, data: JSON.stringify(frame.event) };
          case 'keepalive':
            return { type: 'keepalive', data: '' };
        }
      }),
    );
  }
}
