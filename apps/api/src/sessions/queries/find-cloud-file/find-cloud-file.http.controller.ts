import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import type { CloudFile } from '../../application/cloud-files.port';
import { FindCloudFileQuery } from './find-cloud-file.query';

/**
 * `GET /cloud-files/{token}` — a cloud session's agent downloading a file of
 * its first task (`product/next-steps/cloud-agents.md`, "Files for a cloud
 * session"). Public: the agent runs in the vendor's cloud with no credential
 * of ours, so the link's token is what admits it. Left out of the OpenAPI
 * document, since no client of ours calls it.
 */
@Controller('cloud-files')
export class FindCloudFileHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':token')
  @Version('1')
  @NoPolicy('a cloud agent with no account of ours; the unguessable, day-long token admits it')
  // An agent fetches a handful of files once or twice; this only bounds a prober.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Disposition', 'attachment')
  @ApiExcludeEndpoint()
  async find(@Param('token', ParseUUIDPipe) token: string): Promise<StreamableFile> {
    const file = await this.queryBus.execute<FindCloudFileQuery, CloudFile>(
      new FindCloudFileQuery({ token }),
    );
    return new StreamableFile(file.data, { type: file.mediaType, length: file.data.length });
  }
}
