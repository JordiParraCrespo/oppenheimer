/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PaginationMetaDto = {
    properties: {
        total: {
            type: 'number',
            description: `Total matching records, across all pages.`,
            isRequired: true,
        },
        page: {
            type: 'number',
            description: `1-based page number.`,
            isRequired: true,
        },
        limit: {
            type: 'number',
            description: `Records per page.`,
            isRequired: true,
        },
        totalPages: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
