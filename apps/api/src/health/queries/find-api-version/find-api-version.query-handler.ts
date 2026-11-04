import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { VersionResponseDto } from '../../dtos/version.response.dto';
import { readApiVersion } from '../../infrastructure/api-version.util';
import { FindApiVersionQuery } from './find-api-version.query';

/** The release this API runs, read once from its `package.json` when the handler is built. */
@QueryHandler(FindApiVersionQuery)
export class FindApiVersionQueryHandler
  implements IQueryHandler<FindApiVersionQuery, VersionResponseDto>
{
  private readonly version = readApiVersion();

  async execute(): Promise<VersionResponseDto> {
    return { version: this.version };
  }
}
