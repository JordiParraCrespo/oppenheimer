/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type InvitationResponseDto = {
    id: string;
    organizationId: string;
    email: string;
    role: string | null;
    /**
     * pending | accepted | rejected | canceled.
     */
    status: string;
    teamId: string | null;
    inviterId: string;
    expiresAt: string;
    createdAt: string;
};

