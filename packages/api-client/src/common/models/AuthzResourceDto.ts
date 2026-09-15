/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ResourceActionDto } from './ResourceActionDto';
export type AuthzResourceDto = {
    subject: string;
    label: string;
    group: string;
    actions: Array<ResourceActionDto>;
    /**
     * Attributes that may be granted or denied individually.
     */
    fields?: Array<string>;
    /**
     * Scope dimensions this resource can be narrowed by.
     */
    scopes: Array<string>;
    /**
     * Credential-scope group, when the resource is reachable by API tokens.
     */
    credentialScope?: string;
};

