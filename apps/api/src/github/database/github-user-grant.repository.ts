import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubUserGrantOrmEntity } from './github-user-grant.orm-entity';
import type {
  GithubUserGrantRecord,
  GithubUserGrantRepositoryPort,
} from './github-user-grant.repository.port';

@Injectable()
export class GithubUserGrantRepository implements GithubUserGrantRepositoryPort {
  constructor(
    @InjectRepository(GithubUserGrantOrmEntity)
    private readonly repository: Repository<GithubUserGrantOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<GithubUserGrantRecord | null> {
    const record = await this.repository.findOne({ where: { userId } });
    return record ? toRecord(record) : null;
  }

  async upsert(grant: GithubUserGrantRecord): Promise<void> {
    await this.repository.upsert(
      { ...grant, githubUserId: String(grant.githubUserId) },
      { conflictPaths: ['userId'] },
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}

function toRecord(record: GithubUserGrantOrmEntity): GithubUserGrantRecord {
  return {
    userId: record.userId,
    githubUserId: Number(record.githubUserId),
    login: record.login,
    accessTokenSealed: record.accessTokenSealed,
    accessExpiresAt: record.accessExpiresAt,
    refreshTokenSealed: record.refreshTokenSealed,
    refreshExpiresAt: record.refreshExpiresAt,
  };
}
