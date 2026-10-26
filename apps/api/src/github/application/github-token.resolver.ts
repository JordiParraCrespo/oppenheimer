import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubTokenRepositoryRecord } from '../database/github-token.orm-entity';
import type {
  GithubTokenRecord,
  GithubTokenRepositoryPort,
} from '../database/github-token.repository.port';
import { GithubErrors } from '../domain/github.errors';
import type { TokenRepository } from '../domain/github-token.types';
import { chooseToken, isUsable, type TokenCandidate } from '../domain/token-key.policy';
import { GITHUB_TOKEN_REPOSITORY, GITHUB_TOKENS, USER_TOKEN_SEALER } from '../github.di-tokens';
import { GithubTokenMapper } from '../github-token.mapper';
import type { GithubCredential } from '../infrastructure/github-pulls.port';
import type { GithubTokenInspection, GithubTokensPort } from '../infrastructure/github-tokens.port';
import type { UserTokenSealerPort } from '../infrastructure/user-token-sealer.port';

/**
 * A person's own GitHub tokens (`product/next-steps/0.2-pull-requests.md`
 * §6.2): adding and checking them against GitHub, and which one reads a
 * repository no installation covers. The secrets are opened here and nowhere
 * else, and only into a {@link GithubCredential} for one read.
 */
@Injectable()
export class GithubTokenResolver {
  constructor(
    @Inject(GITHUB_TOKEN_REPOSITORY)
    private readonly tokens: GithubTokenRepositoryPort,
    @Inject(GITHUB_TOKENS)
    private readonly github: GithubTokensPort,
    @Inject(USER_TOKEN_SEALER)
    private readonly sealer: UserTokenSealerPort,
    private readonly mapper: GithubTokenMapper,
  ) {}

  isConfigured(): boolean {
    return this.sealer.isConfigured();
  }

  async findOwn(userId: string): Promise<GithubTokenRecord[]> {
    return this.tokens.findOwn(userId);
  }

  /** Asks GitHub about the token first; nothing is kept from one GitHub refuses. */
  async add(userId: string, label: string, secret: string, now: Date): Promise<string> {
    this.assertConfigured();
    const inspection = await this.github.inspect(secret);
    const added = await this.tokens.insert({
      userId,
      label,
      tokenSealed: this.sealer.seal(secret),
      ...this.mapper.toCheck(inspection, now),
    });
    if (added === 'label_taken') throw labelTaken(label);
    return added.id;
  }

  /**
   * Asks GitHub again what the token opens and when it expires. A token GitHub
   * now refuses is marked, so it stops being chosen, and the refusal answered.
   */
  async recheck(userId: string, id: string, now: Date): Promise<void> {
    this.assertConfigured();
    const token = await this.requireOwn(userId, id);
    let inspection: GithubTokenInspection;
    try {
      inspection = await this.github.inspect(this.sealer.open(token.tokenSealed));
    } catch (error) {
      if (error instanceof AppError && error.code === GithubErrors.TOKEN_REFUSED.code) {
        await this.tokens.recordRefusal(userId, id, now);
      }
      throw error;
    }
    await this.tokens.recordCheck(userId, id, this.mapper.toCheck(inspection, now));
  }

  async relabel(userId: string, id: string, label: string): Promise<void> {
    const renamed = await this.tokens.relabel(userId, id, label);
    if (renamed === 'label_taken') throw labelTaken(label);
    if (!renamed) throw notFound(id);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.tokens.delete(userId, id))) throw notFound(id);
  }

  /** Pins the token to the repository; it must be the person's, and open it. */
  async pin(userId: string, githubRepoId: number, tokenId: string): Promise<void> {
    const token = await this.requireOwn(userId, tokenId);
    if (!token.repositories.some((repository) => repository.githubRepoId === githubRepoId)) {
      throw new AppError(GithubErrors.NO_TOKEN_FOR_REPOSITORY, {
        detail: `Token ${token.label} does not open repository ${githubRepoId}`,
      });
    }
    await this.tokens.pin(userId, { githubRepoId, tokenId });
  }

  async unpin(userId: string, githubRepoId: number): Promise<void> {
    await this.tokens.unpin(userId, githubRepoId);
  }

  /**
   * Every repository the person's tokens open, archived ones aside, each with
   * the token that reads it now. A repository only a refused or expired token
   * opens is still listed, with no token, so its watch and its rows can say
   * which token to replace.
   */
  async repositoriesOf(userId: string, now: Date): Promise<TokenRepository[]> {
    const [tokens, pins] = await Promise.all([
      this.tokens.findOwn(userId),
      this.tokens.findPins(userId),
    ]);
    const candidates = tokens.map(candidateOf);
    const pinOf = new Map(pins.map((pin) => [pin.githubRepoId, pin.tokenId]));
    const seen = new Map<number, GithubTokenRepositoryRecord>();
    for (const token of tokens) {
      for (const repository of token.repositories) {
        if (!repository.archived && !seen.has(repository.githubRepoId)) {
          seen.set(repository.githubRepoId, repository);
        }
      }
    }
    return [...seen.values()].map((repository) => {
      const pinnedId = pinOf.get(repository.githubRepoId) ?? null;
      const chosen = chooseToken(repository.githubRepoId, candidates, pinnedId, now);
      return {
        githubRepoId: repository.githubRepoId,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        private: repository.private,
        tokenId: chosen?.id ?? null,
        pinned: chosen !== null && chosen.id === pinnedId,
      };
    });
  }

  /**
   * The credential that reads the repository now, counted against the person
   * the token belongs to. `GITHUB_023` when no token of theirs that still works
   * opens it.
   */
  async credentialFor(userId: string, githubRepoId: number, now: Date): Promise<GithubCredential> {
    this.assertConfigured();
    const [tokens, pins] = await Promise.all([
      this.tokens.findOwn(userId),
      this.tokens.findPins(userId),
    ]);
    const pinned = pins.find((pin) => pin.githubRepoId === githubRepoId)?.tokenId ?? null;
    const chosen = chooseToken(githubRepoId, tokens.map(candidateOf), pinned, now);
    const token = tokens.find((candidate) => candidate.id === chosen?.id);
    if (!token) {
      throw new AppError(GithubErrors.NO_TOKEN_FOR_REPOSITORY, {
        detail: `No GitHub token of yours that still works opens repository ${githubRepoId}`,
      });
    }
    return {
      token: this.sealer.open(token.tokenSealed),
      bucket: `user:${token.githubUserId}`,
      cacheScope: `token:${token.id}`,
      // A token revoked on GitHub stops being chosen at once, and another
      // that opens the repository takes over on the next read.
      onUnauthorized: () => this.tokens.recordRefusal(userId, token.id, new Date()),
    };
  }

  /** Whether the token is one GitHub still accepts, for the settings list. */
  isUsable(token: GithubTokenRecord, now: Date): boolean {
    return isUsable(candidateOf(token), now);
  }

  private async requireOwn(userId: string, id: string): Promise<GithubTokenRecord> {
    const token = await this.tokens.findOneOwn(userId, id);
    if (!token) throw notFound(id);
    return token;
  }

  private assertConfigured(): void {
    if (this.isConfigured()) return;
    throw new AppError(GithubErrors.TOKENS_NOT_CONFIGURED, {
      detail: 'Set GITHUB_USER_TOKEN_KEY to keep GitHub tokens on this server.',
    });
  }
}

function candidateOf(token: GithubTokenRecord): TokenCandidate {
  return {
    id: token.id,
    repositoryIds: token.repositories.map((repository) => repository.githubRepoId),
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    refusedAt: token.refusedAt,
  };
}

function notFound(id: string): AppError {
  return new AppError(GithubErrors.TOKEN_NOT_FOUND, { detail: `No GitHub token with id ${id}` });
}

function labelTaken(label: string): AppError {
  return new AppError(GithubErrors.TOKEN_LABEL_TAKEN, {
    detail: `You already have a GitHub token labelled "${label}"`,
  });
}
