/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthzResourceGroupDto } from './AuthzResourceGroupDto';
import type { AuthzRuleDto } from './AuthzRuleDto';
export type AuthzCatalogResponseDto = {
    groups: Array<AuthzResourceGroupDto>;
    /**
     * Rules the caller may put on a role. Anything outside this list is rejected, so the role builder can disable it up front.
     */
    grantable: Array<AuthzRuleDto>;
};

