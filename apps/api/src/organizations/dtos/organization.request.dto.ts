import {
  addMemberSchema,
  addWorkspaceMemberSchema,
  checkSlugSchema,
  createOrganizationSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  listMembersSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
  updateWorkspaceSchema,
} from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateOrganizationRequest extends createZodDto(createOrganizationSchema) {}
export class UpdateOrganizationRequest extends createZodDto(updateOrganizationSchema) {}
export class CheckSlugRequest extends createZodDto(checkSlugSchema) {}
export class AddMemberRequest extends createZodDto(addMemberSchema) {}
export class ListMembersRequest extends createZodDto(listMembersSchema) {}
export class UpdateMemberRoleRequest extends createZodDto(updateMemberRoleSchema) {}
export class InviteMemberRequest extends createZodDto(inviteMemberSchema) {}
export class CreateWorkspaceRequest extends createZodDto(createWorkspaceSchema) {}
export class UpdateWorkspaceRequest extends createZodDto(updateWorkspaceSchema) {}
export class AddWorkspaceMemberRequest extends createZodDto(addWorkspaceMemberSchema) {}
