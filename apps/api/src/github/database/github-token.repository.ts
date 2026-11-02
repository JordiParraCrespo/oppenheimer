import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { GithubTokenOrmEntity } from './github-token.orm-entity';
import type {
  GithubTokenCheck,
  GithubTokenPinRecord,
  GithubTokenRecord,
  GithubTokenRepositoryPort,
} from './github-token.repository.port';
import { GithubTokenPinOrmEntity } from './github-token-pin.orm-entity';

/** Postgres' code for a unique violation. */
const UNIQUE_VIOLATION = '23505';
const LABEL_KEY = 'UQ_github_token_user_label';

@Injectable()
export class GithubTokenRepository implements GithubTokenRepositoryPort {
  constructor(
    @InjectRepository(GithubTokenOrmEntity)
    private readonly tokens: Repository<GithubTokenOrmEntity>,
    @InjectRepository(GithubTokenPinOrmEntity)
    private readonly pins: Repository<GithubTokenPinOrmEntity>,
  ) {}

  async findOwn(userId: string): Promise<GithubTokenRecord[]> {
    const rows = await this.tokens.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toRecord);
  }

  async findOneOwn(userId: string, id: string): Promise<GithubTokenRecord | null> {
    const row = await this.tokens.findOne({ where: { userId, id } });
    return row ? toRecord(row) : null;
  }

  async insert(
    token: Omit<GithubTokenRecord, 'id' | 'createdAt' | 'refusedAt'>,
  ): Promise<{ id: string } | 'label_taken'> {
    try {
      const saved = await this.tokens.save(
        this.tokens.create({
          ...token,
          githubUserId: String(token.githubUserId),
          refusedAt: null,
        }),
      );
      return { id: saved.id };
    } catch (error) {
      if (isLabelTaken(error)) return 'label_taken';
      throw error;
    }
  }

  async relabel(userId: string, id: string, label: string): Promise<boolean | 'label_taken'> {
    try {
      const result = await this.tokens.update({ userId, id }, { label });
      return result.affected === 1;
    } catch (error) {
      if (isLabelTaken(error)) return 'label_taken';
      throw error;
    }
  }

  async recordCheck(userId: string, id: string, check: GithubTokenCheck): Promise<boolean> {
    const result = await this.tokens.update(
      { userId, id },
      { ...check, githubUserId: String(check.githubUserId), refusedAt: null },
    );
    return result.affected === 1;
  }

  async recordRefusal(userId: string, id: string, at: Date): Promise<void> {
    await this.tokens.update({ userId, id }, { refusedAt: at });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.tokens.delete({ userId, id });
    return result.affected === 1;
  }

  async findPins(userId: string): Promise<GithubTokenPinRecord[]> {
    const rows = await this.pins.find({ where: { userId } });
    return rows.map((row) => ({ githubRepoId: Number(row.githubRepoId), tokenId: row.tokenId }));
  }

  async pin(userId: string, pin: GithubTokenPinRecord): Promise<void> {
    await this.pins.upsert(
      { userId, githubRepoId: String(pin.githubRepoId), tokenId: pin.tokenId },
      { conflictPaths: ['userId', 'githubRepoId'] },
    );
  }

  async unpin(userId: string, githubRepoId: number): Promise<void> {
    await this.pins.delete({ userId, githubRepoId: String(githubRepoId) });
  }
}

function isLabelTaken(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; constraint?: string };
  return driver.code === UNIQUE_VIOLATION && driver.constraint === LABEL_KEY;
}

function toRecord(row: GithubTokenOrmEntity): GithubTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    kind: row.kind,
    githubUserId: Number(row.githubUserId),
    login: row.login,
    tokenSealed: row.tokenSealed,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    repositories: row.repositories,
    checkedAt: row.checkedAt,
    refusedAt: row.refusedAt,
    createdAt: row.createdAt,
  };
}
