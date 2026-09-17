/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvitationResponseDto } from './InvitationResponseDto';
import type { MemberResponseDto } from './MemberResponseDto';
export type FullOrganizationResponseDto = {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    /**
     * Free-form JSON metadata.
     */
    metadata: Record<string, any> | null;
    createdAt: string;
    members: Array<MemberResponseDto>;
    invitations: Array<InvitationResponseDto>;
    /**
     * Workspaces (Better Auth teams) in this organization.
     */
    teams: Array<Record<string, any>>;
};

