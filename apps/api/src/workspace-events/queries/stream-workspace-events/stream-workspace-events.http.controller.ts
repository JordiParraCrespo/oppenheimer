import {
  Controller,
  type MessageEvent,
  Sse,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import {
  WORKSPACE_STREAM_EVENT,
  WORKSPACE_STREAM_READY,
} from '@oppenheimer/shared/workspace-events';
import { map, type Observable } from 'rxjs';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { StreamWorkspaceEventsQuery } from './stream-workspace-events.query';
import type { WorkspaceStreamFrame } from './stream-workspace-events.query-handler';

@ApiTags('Workspace events')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('events')
export class StreamWorkspaceEventsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Sse()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read', 'hosts:read', 'automations:read')
  @RequireFlag('workspace_event_stream')
  @ApiOperation({
    summary: 'Stream what changes in the caller’s workspace',
    description:
      'Server-Sent Events. A `ready` event once the stream is subscribed, then one `change` event per change, whose data is `{ type, id, … }` (`@oppenheimer/shared/workspace-events`): an invalidation, never the row, so the client re-reads it through its own endpoint. A `keepalive` event comes every 25 s, and the stream ends after 15 minutes so the client redials and is authenticated again.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({ status: 200, description: 'The event stream' })
  async stream(@CurrentAccessScope() scope: AccessScope): Promise<Observable<MessageEvent>> {
    const frames = await this.queryBus.execute<
      StreamWorkspaceEventsQuery,
      Observable<WorkspaceStreamFrame>
    >(
      new StreamWorkspaceEventsQuery({
        userId: scope.userId,
        organizationId: scope.organizationId,
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
