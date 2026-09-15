/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type LeadResponseDto = {
    id: string;
    organizationId: string;
    teamId?: string | null;
    ownerId?: string | null;
    name: string;
    email?: string | null;
    /**
     * Deal value in minor units.
     */
    value: number;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
};

