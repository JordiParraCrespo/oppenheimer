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
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import type { ParkedImage } from '../../../links/application/parked-image.port';
import { CurrentHost } from '../../decorators/current-host.decorator';
import { HostPrincipalGuard } from '../../guards/host-principal.guard';
import { CollectSessionImageCommand } from './collect-session-image.command';

/**
 * `GET /hosts/self/images/{commandId}` — the runner pulling the image a
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
    operationId: 'collectSessionImage',
    summary: 'Collect an image parked for the calling host',
    description:
      'Called by the runner when a `session.image` arrives on its link. Answers the image once; a second pull, an expired image and another host’s image are all 404.',
  })
  @ApiProduces('image/png', 'image/jpeg', 'image/gif', 'image/webp')
  @ApiResponse({ status: 200, description: 'The image’s bytes' })
  @ApiProblemResponse({
    status: 401,
    description: 'No valid host assertion was presented',
    code: 'HOSTS_005',
  })
  @ApiProblemResponse({ status: 404, description: 'No image is waiting', code: 'HOSTS_006' })
  async collect(
    @CurrentHost() hostId: string,
    @Param('commandId', ParseUUIDPipe) commandId: string,
  ): Promise<StreamableFile> {
    const image = await this.commandBus.execute<CollectSessionImageCommand, ParkedImage>(
      new CollectSessionImageCommand({ hostId, commandId }),
    );
    return new StreamableFile(image.data, {
      type: image.mediaType,
      length: image.data.length,
    });
  }
}
