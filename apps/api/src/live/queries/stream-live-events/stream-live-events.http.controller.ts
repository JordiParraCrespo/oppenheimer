import {
  Controller,
  type MessageEvent,
  Sse,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import {
  LIVE_EVENT_NAME,
  LIVE_HEARTBEAT_MS,
  LIVE_STREAM_MAX_AGE_MS,
  type LiveEvent,
} from '@oppenheimer/shared/live';
import { interval, map, merge, type Observable, startWith, takeUntil, timer } from 'rxjs';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { LiveErrors } from '../../domain/live.errors';
import { StreamLiveEventsQuery } from './stream-live-events.query';

/** How soon a console dials again once a stream ends. */
const RECONNECT_MS = 1_000;

@ApiTags('Live')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('live')
export class StreamLiveEventsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Sse()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @RequireFlag('live_events')
  @ApiOperation({
    summary: 'Hear which of the workspace’s sessions changed',
    description:
      'Server-sent events. Each `live` event names a row that changed (`{ "type": "session.changed", "sessionId": … }`), never the row itself: read it again from its own endpoint. A `ping` keeps the connection open; the stream ends after five minutes and the client dials again, which is when the caller is authorized afresh.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'The event stream', schema: { type: 'string' } })
  @ApiProblemResponse({
    status: 400,
    description: 'The caller has no active workspace',
    code: 'LIVE_002',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'The event bus cannot be reached; poll instead',
    code: 'LIVE_001',
  })
  async stream(@CurrentAccessScope() scope: AccessScope): Promise<Observable<MessageEvent>> {
    if (!scope.organizationId) throw new AppError(LiveErrors.NO_WORKSPACE);
    const events = await this.queryBus.execute<StreamLiveEventsQuery, Observable<LiveEvent>>(
      new StreamLiveEventsQuery({ organizationId: scope.organizationId }),
    );
    return merge(
      events.pipe(map((event): MessageEvent => ({ type: LIVE_EVENT_NAME, data: event }))),
      interval(LIVE_HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: '' }))),
    ).pipe(
      startWith<MessageEvent>({ type: 'ready', data: '', retry: RECONNECT_MS }),
      takeUntil(timer(LIVE_STREAM_MAX_AGE_MS)),
    );
  }
}
