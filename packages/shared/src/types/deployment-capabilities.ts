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
 *
 * `session_namer` is the smallest of them: it says whether a *model* titles
 * sessions. Without one, a session is still named — from its first prompt's own
 * words — which costs nothing. It is a capability so that "why is no title ever
 * a model's" is answered by the startup log rather than by reading the naming
 * code.
 */
export const DEPLOYMENT_CAPABILITIES = [
  'google_oauth',
  'github_oauth',
  'stripe_billing',
  's3_storage',
  'email_delivery',
  'github_app',
  'hosts',
  'session_namer',
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

/**
 * What `GET /health/capabilities` answers: the flags above, plus the values a
 * client cannot derive from them.
 *
 * The install URL is here rather than in the browser's own environment because
 * it is built from `GITHUB_APP_SLUG`, which the server already holds. A second
 * copy in a `VITE_*` variable is a thing to keep in sync by hand, and the
 * installer fetching the hosted manifest is what that costs.
 *
 * `null` whenever `github_app` is false: with no App there is no page to send
 * anyone to, and a link to `github.com/apps/undefined` is a 404 dressed as an
 * offer.
 */
export interface ClientDeployment extends ClientCapabilities {
  github_app_install_url: string | null;
}
