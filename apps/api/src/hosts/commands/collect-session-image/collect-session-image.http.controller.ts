import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '@oppenheimer/backend-authz';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { SESSION_FILE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import type { ParkedFile } from '../../../links/application/parked-file.port';
import { CurrentHost } from '../../decorators/current-host.decorator';
import { HostPrincipalGuard } from '../../guards/host-principal.guard';
import { CollectSessionImageCommand } from './collect-session-image.command';

/**
 * `GET /hosts/self/images/{commandId}` — the runner pulling the file a
 * `session.image` named (`product/versions/mvp/01-protocol.md`). The bytes
 * never ride the link; this is where they come from.
 *
 * Like `DELETE /hosts/self`, the credential is the host's boot assertion and
 * `HostPrincipalGuard` is the whole of the authorization: the path names no
 * host, so a host can only ever collect what was parked for itself.
 */
@ApiTags('Hosts')
@ApiBearerAuth()
@UseGuards(HostPrincipalGuard)
@Controller('hosts')
export class CollectSessionImageHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Get('self/images/:commandId')
  @Version('1')
  @NoPolicy('the caller is a host, not a user: it is identified by the assertion it signed')
  @AllowAnyScope()
  @ApiOperation({
    summary: 'Collect a file parked for the calling host',
    description:
      'Called by the runner when a `session.image` or a `session.create` with files arrives on its link. Answers the file once; a second pull, an expired file and another host’s file are all 404.',
  })
  @ApiProduces(...SESSION_FILE_MEDIA_TYPES)
  @ApiResponse({ status: 200, description: 'The file’s bytes' })
  @ApiProblemResponse({
    status: 401,
    description: 'No valid host assertion was presented',
    code: 'HOSTS_005',
  })
  @ApiProblemResponse({ status: 404, description: 'No image is waiting', code: 'HOSTS_007' })
  async collect(
    @CurrentHost() hostId: string,
    @Param('commandId', ParseUUIDPipe) commandId: string,
  ): Promise<StreamableFile> {
    const image = await this.commandBus.execute<CollectSessionImageCommand, ParkedFile>(
      new CollectSessionImageCommand({ hostId, commandId }),
    );
    return new StreamableFile(image.data, {
      type: image.mediaType,
      length: image.data.length,
    });
  }
}
