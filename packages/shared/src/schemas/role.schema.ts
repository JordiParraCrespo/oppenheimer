import { z } from 'zod';

/**
 * A single CASL rule on a role. `action` and `subject` are free-form so admins
 * can author permissions for any resource; `conditions` enables resource
 * scoping (values may contain `${user.id}`-style placeholders).
 */
export const permissionSchema = z.object({
  action: z.string().min(1),
  subject: z.string().min(1),
  conditions: z.record(z.unknown()).optional(),
  fields: z.array(z.string().min(1)).optional(),
  inverted: z.boolean().optional(),
  reason: z.string().optional(),
});

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/),
  description: z.string().max(255).optional(),
  permissions: z.array(permissionSchema).default([]),
});

export const updateRoleSchema = z.object({
  description: z.string().max(255).optional(),
  permissions: z.array(permissionSchema).optional(),
});

/** Replace the full permission set of a role (granular permission editing). */
export const updateRolePermissionsSchema = z.object({
  permissions: z.array(permissionSchema),
});

/** Replace the set of roles assigned to a user. */
export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});

export const memberRoleFormSchema = z.object({
  roleId: z.string().uuid().nullable(),
});

export const roleEditorSchema = z.object({
  name: createRoleSchema.shape.name,
  description: createRoleSchema.shape.description,
  permissions: z.array(permissionSchema),
});

export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  organizationId: z.string().uuid().nullable(),
  permissions: z.array(permissionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PermissionDto = z.infer<typeof permissionSchema>;
export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
export type AssignUserRolesDto = z.infer<typeof assignUserRolesSchema>;
export type MemberRoleFormDto = z.infer<typeof memberRoleFormSchema>;
export type RoleEditorDto = z.infer<typeof roleEditorSchema>;
export type RoleResponse = z.infer<typeof roleResponseSchema>;
