import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { Invitation } from '../domain/invitation.types';
import { OrganizationMapper } from '../organization.mapper';
import { InvitationOrmEntity } from './invitation.orm-entity';
import type { InvitationRepositoryPort } from './invitation.repository.port';

@Injectable()
export class InvitationRepository implements InvitationRepositoryPort {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitations: Repository<InvitationOrmEntity>,
  ) {}

  async findOneById(invitationId: string): Promise<Option<Invitation>> {
    const row = await this.invitations.findOne({ where: { id: invitationId } });
    return row ? Some(OrganizationMapper.toInvitation(row)) : None;
  }

  async reopen(invitationId: string): Promise<void> {
    await this.invitations.update({ id: invitationId, status: 'accepted' }, { status: 'pending' });
  }

  async markAccepted(invitationId: string): Promise<void> {
    await this.invitations.update({ id: invitationId, status: 'pending' }, { status: 'accepted' });
  }
}
