import { type APIRequestContext, type APIResponse, expect, request } from '@playwright/test';
import { API_URL, WEB_URL } from '../playwright.config';

/** A password that satisfies every rule the app states, for the happy paths. */
export const VALID_PASSWORD = 'Sup3rSecret!Pass';

let counter = 0;

/** A fresh identity per test, so tests never contend over the same rows. */
export function newUser(prefix = 'user') {
  counter += 1;
  const stamp = `${Date.now().toString(36)}-${process.pid}-${counter}`;
  return {
    email: `${prefix}-${stamp}@e2e.oppenheimer.test`,
    password: VALID_PASSWORD,
    firstName: 'Test',
    lastName: 'User',
    get name() {
      return `${this.firstName} ${this.lastName}`;
    },
  };
}

export type TestUser = ReturnType<typeof newUser>;

/**
 * An isolated request context — its own cookie jar, so one test's sign-in
 * cannot leak into another's "unauthenticated" assertions.
 */
export async function newContext(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    // Better Auth refuses a cookie-bearing state change that arrives with no
    // `Origin` (MISSING_OR_NULL_ORIGIN) — its CSRF defence. A browser always
    // sends one; a bare API client does not, so the tests send the web app's
    // origin, which the API lists as trusted.
    extraHTTPHeaders: { Origin: WEB_URL },
  });
}

export async function signUp(api: APIRequestContext, user: TestUser): Promise<APIResponse> {
  return api.post('/api/auth/sign-up/email', {
    data: {
      email: user.email,
      password: user.password,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    failOnStatusCode: false,
  });
}

export async function signIn(
  api: APIRequestContext,
  email: string,
  password: string,
): Promise<APIResponse> {
  return api.post('/api/auth/sign-in/email', {
    data: { email, password },
    failOnStatusCode: false,
  });
}

export async function signOut(api: APIRequestContext): Promise<APIResponse> {
  return api.post('/api/auth/sign-out', { data: {}, failOnStatusCode: false });
}

export async function getSession(api: APIRequestContext): Promise<APIResponse> {
  return api.get('/api/auth/get-session', { failOnStatusCode: false });
}

export async function requestPasswordReset(
  api: APIRequestContext,
  email: string,
  redirectTo = 'http://localhost:3000/reset-password',
): Promise<APIResponse> {
  return api.post('/api/auth/request-password-reset', {
    data: { email, redirectTo },
    failOnStatusCode: false,
  });
}

export async function resetPassword(
  api: APIRequestContext,
  token: string,
  newPassword: string,
): Promise<APIResponse> {
  return api.post('/api/auth/reset-password', {
    data: { token, newPassword },
    failOnStatusCode: false,
  });
}

export async function changePassword(
  api: APIRequestContext,
  currentPassword: string,
  newPassword: string,
  revokeOtherSessions = false,
): Promise<APIResponse> {
  return api.post('/api/auth/change-password', {
    data: { currentPassword, newPassword, revokeOtherSessions },
    failOnStatusCode: false,
  });
}

/** Signs up and returns a context already carrying that user's session cookie. */
export async function signedUpContext(
  prefix = 'user',
): Promise<{ api: APIRequestContext; user: TestUser; userId: string }> {
  const api = await newContext();
  const user = newUser(prefix);
  const response = await signUp(api, user);
  expect(response.status(), `sign-up for ${user.email} should succeed`).toBe(200);
  const body = await response.json();
  return { api, user, userId: body.user.id };
}

/**
 * Asserts a response is an RFC 7807 problem document — the shape
 * `AllExceptionsFilter` promises for every failure the API itself produces.
 */
export async function expectProblemDocument(
  response: APIResponse,
  expected: { status: number; code?: string },
): Promise<Record<string, unknown>> {
  expect(response.status()).toBe(expected.status);
  expect(response.headers()['content-type']).toContain('application/problem+json');
  const body = await response.json();
  expect(body).toMatchObject({ status: expected.status });
  expect(body.title, 'a problem document carries a human-readable title').toBeTruthy();
  expect(body.type, 'a problem document carries a type URI').toBeTruthy();
  if (expected.code) expect(body.code).toBe(expected.code);
  return body;
}

/** The session cookie as the browser would see it, for attribute assertions. */
export async function sessionCookie(api: APIRequestContext) {
  const { cookies } = await api.storageState();
  return cookies.find((cookie) => cookie.name.includes('session_token'));
}
