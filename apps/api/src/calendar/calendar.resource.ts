import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Plan's calendar is workspace-owned like the board: the workspace's own events,
 * read by every member. A Google connection is read under the same subject but is
 * also a person's: every read of one adds its owner, so nobody reads another's.
 */
export const CalendarResource = defineResource({
  subject: 'Calendar',
  label: 'Calendar',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View the calendar' },
    { name: 'create', label: 'Add events and connect Google Calendar' },
    { name: 'update', label: 'Change events' },
    { name: 'delete', label: 'Delete events and disconnect Google Calendar' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'calendar',
});
