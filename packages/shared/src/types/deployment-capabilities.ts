/**
 * The optional capabilities a deployment may or may not have, resolved from
 * configuration once at boot. Each one maps to config a self-hoster might not
 * have (OAuth credentials, a Stripe key, S3 credentials, SMTP/Resend settings);
 * a missing key removes the capability — it never prevents the app from
 * booting. Required settings (database, `BETTER_AUTH_SECRET`) are the
 * opposite: they fail fast at boot and are not capabilities.
 *
 * `hosts` is the control plane's: without the runner release settings and the
 * signing key there is nothing to hand a machine that wants to pair, so the
 * host routes answer "not configured" and the rest of the API is unaffected.
 */
export const DEPLOYMENT_CAPABILITIES = [
  'google_oauth',
  'github_oauth',
  'stripe_billing',
  's3_storage',
  'email_delivery',
  'hosts',
  'github_app',
] as const;

export type DeploymentCapability = (typeof DEPLOYMENT_CAPABILITIES)[number];

/**
 * Which optional features a deployment can actually serve. `false` means "not
 * configured on this install", not an outage. The full set stays inside the
 * API (startup log, feature guards); only the client-facing subset below goes
 * over the wire.
 */
export type DeploymentCapabilities = Record<DeploymentCapability, boolean>;

/**
 * The subset of capabilities clients have a UI decision hanging on — served by
 * `GET /health/capabilities`. Server-internal capabilities (`s3_storage`,
 * `email_delivery`) are deliberately not on the wire: no client renders
 * anything differently for them, and a public endpoint should not describe a
 * deployment's infrastructure beyond what its UI already reveals.
 */
export const CLIENT_CAPABILITIES = [
  'google_oauth',
  'github_oauth',
  'stripe_billing',
  // The sessions GitHub App. A console cannot read this off anything else: an
  // empty installation list says "you have not connected yet", never "this
  // deployment has no App, so Connect GitHub will fail" — and the App slug the
  // install link is built from only exists when the capability is on.
  'github_app',
] as const satisfies readonly DeploymentCapability[];

export type ClientCapability = (typeof CLIENT_CAPABILITIES)[number];

export type ClientCapabilities = Record<ClientCapability, boolean>;
