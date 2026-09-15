import { z } from 'zod';
import { defineTool } from './tool';

const permission = z
  .object({
    action: z.string().min(1).describe("e.g. 'read', 'create', 'update', 'delete', 'manage'"),
    subject: z.string().min(1).describe("e.g. 'User', 'Article', or 'all' for every subject"),
    conditions: z
      .record(z.string(), z.unknown())
      .optional()
      // biome-ignore lint/suspicious/noTemplateCurlyInString: documents the condition placeholder syntax
      .describe('Resource scoping, e.g. { "authorId": "${user.id}" } for own-resources-only'),
    fields: z.array(z.string()).optional(),
    inverted: z.boolean().optional().describe('Turns the rule into a denial'),
    reason: z.string().optional(),
  })
  .describe('A CASL permission rule');

export const roleTools = [
  defineTool({
    name: 'list_roles',
    title: 'List roles',
    description: 'List roles and the permissions attached to them.',
    requiredScopes: ['roles:read'],
    inputSchema: z.object({
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      search: z.string().optional().describe('Match against the role name'),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (args, { client }) => client.get('/roles', args),
  }),

  defineTool({
    name: 'get_role',
    title: 'Get a role',
    description: 'Read one role, including its full permission set.',
    requiredScopes: ['roles:read'],
    inputSchema: z.object({ id: z.string().uuid() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.get(`/roles/${id}`),
  }),

  defineTool({
    name: 'create_role',
    title: 'Create a role',
    description:
      'Create a custom role with an initial permission set. Role names are lowercase and may contain letters, numbers, - and _.',
    requiredScopes: ['roles:write'],
    inputSchema: z.object({
      name: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-_]+$/),
      description: z.string().max(255).optional(),
      permissions: z.array(permission).optional(),
    }),
    handler: (args, { client }) =>
      client.post('/roles', { ...args, permissions: args.permissions ?? [] }),
  }),

  defineTool({
    name: 'update_role_permissions',
    title: 'Replace a role’s permissions',
    description:
      'Replace a role’s entire permission set. Read the role first and send the full list — anything you omit is removed. Everyone holding the role is affected immediately.',
    requiredScopes: ['roles:write'],
    inputSchema: z.object({
      id: z.string().uuid(),
      permissions: z.array(permission),
    }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: ({ id, permissions }, { client }) =>
      client.put(`/roles/${id}/permissions`, { permissions }),
  }),

  defineTool({
    name: 'delete_role',
    title: 'Delete a role',
    description:
      'Delete a custom role. System roles cannot be deleted. Users holding the role lose its permissions.',
    requiredScopes: ['roles:write'],
    inputSchema: z.object({ id: z.string().uuid() }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async ({ id }, { client }) => {
      await client.delete(`/roles/${id}`);
      return { deleted: true, id };
    },
  }),

  defineTool({
    name: 'list_user_roles',
    title: 'List a user’s roles',
    description: 'List the roles assigned to a user.',
    requiredScopes: ['roles:read'],
    inputSchema: z.object({ userId: z.string().uuid() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ userId }, { client }) => client.get(`/users/${userId}/roles`),
  }),

  defineTool({
    name: 'assign_user_roles',
    title: 'Replace a user’s roles',
    description:
      'Replace the set of roles assigned to a user. Send every role they should hold — anything omitted is unassigned.',
    requiredScopes: ['roles:write'],
    inputSchema: z.object({
      userId: z.string().uuid(),
      roleIds: z.array(z.string().uuid()),
    }),
    annotations: { idempotentHint: true },
    handler: ({ userId, roleIds }, { client }) => client.put(`/users/${userId}/roles`, { roleIds }),
  }),
];
