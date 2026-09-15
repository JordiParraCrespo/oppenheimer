import { ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { LeadCreatedDomainEvent } from '../domain/events/lead-created.domain-event';
import { LeadEntity } from '../domain/lead.entity';

const VALID = { organizationId: 'org-1', name: 'Acme Corp' };

describe('LeadEntity', () => {
  it('raises a creation event carrying the scope keys', () => {
    // The listener should not need an access scope of its own to know who the
    // lead concerns.
    const lead = LeadEntity.createNew({
      ...VALID,
      teamId: 'team-madrid',
      ownerId: 'rep-1',
    });

    const [event] = lead.domainEvents;
    expect(event).toBeInstanceOf(LeadCreatedDomainEvent);
    expect(event).toMatchObject({
      organizationId: 'org-1',
      teamId: 'team-madrid',
      ownerId: 'rep-1',
    });
  });

  it('defaults the optional scope keys to null rather than undefined', () => {
    const lead = LeadEntity.createNew(VALID);

    expect(lead.teamId).toBeNull();
    expect(lead.ownerId).toBeNull();
    expect(lead.value).toBe(0);
  });

  it('refuses a lead with no organization', () => {
    expect(() => LeadEntity.createNew({ ...VALID, organizationId: '  ' })).toThrow(
      ArgumentNotProvidedException,
    );
  });

  it('refuses a blank name', () => {
    expect(() => LeadEntity.createNew({ ...VALID, name: '   ' })).toThrow(
      ArgumentNotProvidedException,
    );
  });

  it('refuses a fractional or negative value', () => {
    // Money is held in minor units, so a fraction means someone passed euros
    // where cents were expected.
    expect(() => LeadEntity.createNew({ ...VALID, value: 12.5 })).toThrow(
      ArgumentNotProvidedException,
    );
    expect(() => LeadEntity.createNew({ ...VALID, value: -1 })).toThrow(
      ArgumentNotProvidedException,
    );
  });

  it('reassigns team and owner through domain methods', () => {
    const lead = LeadEntity.createNew(VALID);

    lead.assignToTeam('team-barcelona');
    lead.assignToOwner('rep-2');

    expect(lead.teamId).toBe('team-barcelona');
    expect(lead.ownerId).toBe('rep-2');
  });

  it('keeps invariants on update', () => {
    const lead = LeadEntity.createNew(VALID);

    expect(() => lead.updateDetails({ name: '' })).toThrow(ArgumentNotProvidedException);
    expect(() => lead.reprice(-5)).toThrow(ArgumentNotProvidedException);
  });
});
