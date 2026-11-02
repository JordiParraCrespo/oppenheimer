import {
  type ArgumentMetadata,
  Injectable,
  Param,
  ParseUUIDPipe,
  type PipeTransform,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import type { RepositorySource } from '../../github/domain/repository-address.types';

/** The path segment that names a repository read through the caller's own tokens (§6.2). */
export const TOKENS_SOURCE = 'tokens';

/**
 * `tokens` is the caller's own tokens; anything else must be an installation's
 * uuid, refused as `ParseUUIDPipe` refuses it. The one place a URL's segment
 * becomes a {@link RepositorySource}.
 */
@Injectable()
class RepositorySourcePipe implements PipeTransform<string, Promise<RepositorySource>> {
  private readonly uuid = new ParseUUIDPipe();

  async transform(value: string, metadata: ArgumentMetadata): Promise<RepositorySource> {
    if (value === TOKENS_SOURCE) return { kind: 'tokens' };
    return { kind: 'installation', installationId: await this.uuid.transform(value, metadata) };
  }
}

/**
 * The `:installationId` segment of a pull request route: the installation
 * that reaches the repository, or `tokens` for one read through the caller's
 * own GitHub tokens.
 */
export const RepositorySourceParam = (): ParameterDecorator =>
  Param('installationId', RepositorySourcePipe);

/** The same segment in the OpenAPI document, which cannot read it off a custom pipe. */
export const ApiRepositorySource = (): MethodDecorator =>
  ApiParam({
    name: 'installationId',
    type: String,
    description: `The installation that reaches the repository, or \`${TOKENS_SOURCE}\` for one read through your own GitHub tokens.`,
    example: TOKENS_SOURCE,
  });
