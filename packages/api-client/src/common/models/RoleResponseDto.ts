/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RoleResponseDto = {
    id: string;
    name: string;
    description: string | null;
    /**
     * System roles cannot be deleted or renamed.
     */
    isSystem: boolean;
    /**
     * Owning organization, or null for a global role template shared by every tenant.
     */
    organizationId?: string | null;
    /**
     * CASL permission rules granted by this role.
     */
    permissions: Array<Record<string, any>>;
    createdAt: string;
    updatedAt: string;
};

