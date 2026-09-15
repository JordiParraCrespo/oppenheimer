/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MemberUserResponseDto } from './MemberUserResponseDto';
export type MemberResponseDto = {
    id: string;
    organizationId: string;
    userId: string;
    /**
     * Organization role (owner | admin | member | custom).
     */
    role: string;
    createdAt: string;
    user: MemberUserResponseDto | null;
};

