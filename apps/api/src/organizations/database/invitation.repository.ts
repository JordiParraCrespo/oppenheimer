import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { Invitation } from '../domain/invitation.types';
import { InvitationOrmEntity } from './invitation.orm-entity';
import type { InvitationRepositoryPort } from './invitation.repository.port';

/** TypeORM adapter behind `INVITATION_REPOSITORY`. */
@Injectable()
export class InvitationRepository implements InvitationRepositoryPort {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitations: Repository<InvitationOrmEntity>,
  ) {}

  async findOneById(invitationId: string): Promise<Option<Invitation>> {
    const row = await this.invitations.findOne({ where: { id: invitationId } });
    if (!row) return None;
    return Some({
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role,
      status: row.status,
      teamId: row.teamId,
      inviterId: row.inviterId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  }
}
