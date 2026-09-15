/**
 * A role is identified by its (free-form) name. The built-in `admin` / `user`
 * roles are seeded as system roles, but admins can create arbitrary additional
 * roles, so this is a plain string rather than a closed union.
 */
export type Role = string;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export {
  CLIENT_CAPABILITIES,
  type ClientCapabilities,
  type ClientCapability,
  DEPLOYMENT_CAPABILITIES,
  type DeploymentCapabilities,
  type DeploymentCapability,
} from './deployment-capabilities';
export {
  DEFAULT_PROBLEM_TYPE,
  type InvalidParam,
  isProblemDetails,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
} from './problem-details';
