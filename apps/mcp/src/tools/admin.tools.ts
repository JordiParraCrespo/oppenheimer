import { z } from 'zod';
import { defineTool } from './tool';

const userId = z.string().uuid().describe('The user’s id');

/**
 * Privileged account operations. These sit behind their own `admin:*` group
 * rather than `users:*` precisely so a token that manages the directory cannot
 * also ban people or take over their accounts.
 */
export const adminTools = [
  defineTool({
    name: 'admin_list_users',
    title: 'List users (admin)',
    description: 'List users through the admin API, including banned ones and their ban state.',
    requiredScopes: ['admin:read'],
    inputSchema: z.object({
      searchValue: z.string().optional(),
      searchField: z.enum(['email', 'name']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (args, { client }) => client.get('/admin/users', args),
  }),

  defineTool({
    name: 'admin_list_user_sessions',
    title: 'List a user’s sessions',
    description: 'List a user’s active sessions.',
    requiredScopes: ['admin:read'],
    inputSchema: z.object({ id: userId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.get(`/admin/users/${id}/sessions`),
  }),

  defineTool({
    name: 'admin_ban_user',
    title: 'Ban a user',
    description:
      'Ban a user, ending their access. Give a reason; an expiry makes the ban temporary.',
    requiredScopes: ['admin:write'],
    inputSchema: z.object({
      id: userId,
      banReason: z.string().max(255).optional(),
      banExpiresIn: z.number().int().positive().optional().describe('Seconds until the ban lifts'),
    }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: ({ id, ...body }, { client }) => client.post(`/admin/users/${id}/ban`, body),
  }),

  defineTool({
    name: 'admin_unban_user',
    title: 'Unban a user',
    description: 'Lift a ban and restore the user’s access.',
    requiredScopes: ['admin:write'],
    inputSchema: z.object({ id: userId }),
    annotations: { idempotentHint: true },
    handler: ({ id }, { client }) => client.post(`/admin/users/${id}/unban`),
  }),

  defineTool({
    name: 'admin_set_user_role',
    title: 'Set a user’s global role',
    description:
      'Set a user’s global role. This governs platform-wide administration — granting an admin role hands over broad access.',
    requiredScopes: ['admin:write'],
    inputSchema: z.object({ id: userId, role: z.string().min(1) }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: ({ id, role }, { client }) => client.post(`/admin/users/${id}/role`, { role }),
  }),

  defineTool({
    name: 'admin_revoke_user_sessions',
    title: 'Revoke a user’s sessions',
    description: 'Sign a user out everywhere by revoking all of their sessions.',
    requiredScopes: ['admin:write'],
    inputSchema: z.object({ id: userId }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.post(`/admin/users/${id}/revoke-sessions`),
  }),
];
