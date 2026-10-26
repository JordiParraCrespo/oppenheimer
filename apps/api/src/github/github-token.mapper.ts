import { Injectable } from '@nestjs/common';
import type { TokenRepository } from './application/github-token.resolver';
import type { GithubTokenRecord } from './database/github-token.repository.port';
import type {
  GithubTokenReadsResponseDto,
  GithubTokenResponseDto,
} from './dtos/github-token.response.dto';

/** A person's tokens on the wire: everything but the secret. Pure: no DI, no I/O. */
@Injectable()
export class GithubTokenMapper {
  toResponse(token: GithubTokenRecord, usable: boolean): GithubTokenResponseDto {
    return {
      id: token.id,
      label: token.label,
      kind: token.kind,
      login: token.login,
      scopes: token.scopes,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      checkedAt: token.checkedAt.toISOString(),
      refusedAt: token.refusedAt?.toISOString() ?? null,
      usable,
      repositories: token.repositories
        .filter((repository) => !repository.archived)
        .map((repository) => ({
          githubRepoId: repository.githubRepoId,
          fullName: repository.fullName,
          private: repository.private,
        })),
      createdAt: token.createdAt.toISOString(),
    };
  }

  toReads(repository: TokenRepository): GithubTokenReadsResponseDto {
    return {
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      private: repository.private,
      tokenId: repository.tokenId,
      pinned: repository.pinned,
    };
  }
}
