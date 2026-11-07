import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { VersionResponseDto } from '../../dtos/version.response.dto';
import { FindApiVersionQuery } from './find-api-version.query';

/**
 * The release this API runs, for Settings → About. Behind a signed-in session
 * rather than beside the public probes: a release number tells a stranger
 * which known vulnerabilities to try. Session-only: no scope, so an API token
 * is refused.
 */
@ApiTags('Health')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('health')
export class FindApiVersionHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('version')
  @Version('1')
  @NoPolicy('any signed-in account may see which release it is talking to')
  @ApiOperation({
    summary: 'The release this API runs',
    description:
      'The `version` of the API package. The console shows it beside its own in Settings → About.',
  })
  @ApiResponse({ status: 200, type: VersionResponseDto, description: 'The API version' })
  find(): Promise<VersionResponseDto> {
    return this.queryBus.execute(new FindApiVersionQuery());
  }
}
