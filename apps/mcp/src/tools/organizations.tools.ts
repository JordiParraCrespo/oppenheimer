import { z } from 'zod';
import { defineTool } from './tool';

const orgId = z.string().uuid().describe('The organization’s id');

export const organizationTools = [
  defineTool({
    name: 'list_organizations',
    title: 'List organizations',
    description: 'List the organizations the credential’s owner belongs to.',
    requiredScopes: ['organizations:read'],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.get('/organizations'),
  }),

  defineTool({
    name: 'get_organization',
    title: 'Get an organization',
    description: 'Read one organization, including its members and workspaces.',
    requiredScopes: ['organizations:read'],
    inputSchema: z.object({ id: orgId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.get(`/organizations/${id}`),
  }),

  defineTool({
    name: 'create_organization',
    title: 'Create an organization',
    description:
      'Create an organization. The caller becomes its owner. A slug is derived from the name when you do not supply one.',
    requiredScopes: ['organizations:write'],
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(50).optional(),
      logo: z.string().url().optional(),
    }),
    handler: (args, { client }) => client.post('/organizations', args),
  }),

  defineTool({
    name: 'update_organization',
    title: 'Update an organization',
    description: 'Rename an organization or change its slug or logo.',
    requiredScopes: ['organizations:write'],
    inputSchema: z.object({
      id: orgId,
      name: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(50).optional(),
      logo: z.string().url().optional(),
    }),
    annotations: { idempotentHint: true },
    handler: ({ id, ...body }, { client }) => client.patch(`/organizations/${id}`, body),
  }),

  defineTool({
    name: 'delete_organization',
    title: 'Delete an organization',
    description:
      'Permanently delete an organization along with its memberships and workspaces. This cannot be undone.',
    requiredScopes: ['organizations:write'],
    inputSchema: z.object({ id: orgId }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async ({ id }, { client }) => {
      await client.delete(`/organizations/${id}`);
      return { deleted: true, id };
    },
  }),

  defineTool({
    name: 'list_members',
    title: 'List organization members',
    description: 'List the members of an organization and their organization roles.',
    requiredScopes: ['members:read'],
    inputSchema: z.object({ organizationId: orgId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ organizationId }, { client }) =>
      client.get(`/organizations/${organizationId}/members`),
  }),

  defineTool({
    name: 'add_member',
    title: 'Add a member',
    description:
      'Add an existing user to an organization. To bring in someone without an account, send an invitation instead.',
    requiredScopes: ['members:write'],
    inputSchema: z.object({
      organizationId: orgId,
      userId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'member']).describe('Their role inside the organization'),
    }),
    handler: ({ organizationId, ...body }, { client }) =>
      client.post(`/organizations/${organizationId}/members`, body),
  }),

  defineTool({
    name: 'update_member_role',
    title: 'Change a member’s role',
    description: 'Change a member’s role within an organization.',
    requiredScopes: ['members:write'],
    inputSchema: z.object({
      organizationId: orgId,
      memberId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'member']),
    }),
    annotations: { idempotentHint: true },
    handler: ({ organizationId, memberId, role }, { client }) =>
      client.patch(`/organizations/${organizationId}/members/${memberId}`, {
        role,
      }),
  }),

  defineTool({
    name: 'remove_member',
    title: 'Remove a member',
    description: 'Remove a member from an organization, by member id or email address.',
    requiredScopes: ['members:write'],
    inputSchema: z.object({
      organizationId: orgId,
      memberIdOrEmail: z.string().min(1),
    }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async ({ organizationId, memberIdOrEmail }, { client }) => {
      await client.delete(
        `/organizations/${organizationId}/members/${encodeURIComponent(memberIdOrEmail)}`,
      );
      return { removed: true, organizationId, memberIdOrEmail };
    },
  }),

  defineTool({
    name: 'list_invitations',
    title: 'List pending invitations',
    description: 'List the invitations still awaiting a response for an organization.',
    requiredScopes: ['invitations:read'],
    inputSchema: z.object({ organizationId: orgId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ organizationId }, { client }) =>
      client.get(`/organizations/${organizationId}/invitations`),
  }),

  defineTool({
    name: 'invite_member',
    title: 'Invite someone to an organization',
    description: 'Send an email invitation to join an organization with a given role.',
    requiredScopes: ['invitations:write'],
    inputSchema: z.object({
      organizationId: orgId,
      email: z.string().email(),
      role: z.enum(['owner', 'admin', 'member']),
    }),
    handler: ({ organizationId, ...body }, { client }) =>
      client.post(`/organizations/${organizationId}/invitations`, body),
  }),

  defineTool({
    name: 'cancel_invitation',
    title: 'Cancel an invitation',
    description: 'Cancel a pending invitation so its link stops working.',
    requiredScopes: ['invitations:write'],
    inputSchema: z.object({ invitationId: z.string().uuid() }),
    annotations: { idempotentHint: true },
    handler: ({ invitationId }, { client }) => client.post(`/invitations/${invitationId}/cancel`),
  }),
];
