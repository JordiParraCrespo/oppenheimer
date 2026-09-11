# 09 — GitHub access: install the App, pick all repos or some

Decision from discussion: the GitHub experience is "install the app,
then choose all repositories or only selected ones", exactly the dialog
GitHub shows for any GitHub App. That installation is the access
control. Sessions can reach the repositories the installation covers and
nothing else.

## 1. One flow, one dialog

A GitHub App can be configured to **request user authorization during
installation**. With that setting on, there is exactly one GitHub round
trip and it does both jobs:

1. **Continue with GitHub.** The only button on the sign-in page. It
   sends you to `github.com/apps/<our-app>/installations/new`.
2. **GitHub's dialog.** Pick the account (your user or an org you
   admin), then **All repositories** or **Only select repositories**,
   approve. GitHub redirects back once, with both an OAuth `code`
   (who you are) and an `installation_id` (what you granted). We create
   your user and store the installation in the same request.
3. **You are in.** The repo chip lists the repositories of that
   installation, fetched live from GitHub.

Returning users click the same button. If the App is already installed
on their account, GitHub skips the picker and only completes the
authorization, so it is a plain sign-in. Adding repositories, adding
another account, or uninstalling all happen on GitHub's configure page,
reached from a "Manage on GitHub" link, and the `installation` and
`installation_repositories` webhooks keep the chip current.

There is no separate sign-in step, no token, nothing to paste, and no
second App to install. One button, one GitHub screen.

## 2. How it differs from Claude Code on the web, and why

Claude Code on the web uses the user's OAuth authorization for access,
so a session can reach any repo the account can see, and the App
installation only adds webhooks. It says so in its docs. We are choosing
the stricter model on purpose:

- **Least privilege by construction.** A personal workspace running
  agents in VMs should not be able to touch every repository the user
  can see. "Only select repositories" is a real boundary enforced by
  GitHub, not by us.
- **It is what the runner host already does.** The existing controller
  is a GitHub App installed on seven selected repositories with
  installation tokens. Same mental model, same code path.
- **Tokens are repo-scoped and short-lived at mint time.** An
  installation access token can be narrowed to specific repositories and
  specific permissions when it is created, and it expires in one hour.
  Per session we mint one token for exactly the one repository the
  session was created for.

## 3. What the App asks for

Repository permissions, kept to what a session needs:

| Permission | Level | Why |
|------------|-------|-----|
| Contents | read and write | clone, push branches |
| Metadata | read | list repositories, branches |
| Pull requests | read and write | Create PR, later |
| Workflows | read and write | pushes that touch `.github/workflows` are rejected without it |

No `Administration`. The runner host's App needs it for repo-scoped
runners; this one does not. No organization permissions. Webhook events:
`installation`, `installation_repositories`, and later `pull_request`
for auto-fix.

Two GitHub Apps, then: the existing runner App keeps its
`Administration` scope and its seven repos; the sessions App is a
separate, narrower App that the user installs on whatever they like.
They never share a private key.

## 4. How a token reaches the guest

Per session, at creation:

1. The control plane, holding the App's private key (F20: never in the
   database, never on the runner host), mints an installation access
   token narrowed to the session's repository with Contents and
   Metadata only. Lifetime one hour.
2. The token goes to the runner over the tailnet inside the job message,
   encrypted to the runner's key (F7).
3. The runner writes it into the cloud-init seed as the input to a git
   credential helper inside the guest, the same path the JIT runner
   configuration takes today (note 08 §2). `git` and `gh` in the guest
   work unmodified for that one repository.
4. Before expiry the runner requests a fresh token from the control
   plane and rotates it into the guest over vsock. Sessions live for
   days; the token never does.

Later slice: the host egress proxy from note 02 replaces step 3, so the
token never enters the guest at all. The App, the minting, and the
scoping are identical either way.

## 5. What this adds to the plan

| Piece | Where | Size |
|-------|-------|------|
| Register the sessions GitHub App, store its private key in the control plane secret store | ops | tiny |
| One callback that handles the OAuth code and the installation id together; user and installation records | control plane + web | small |
| Live repository and branch listing for the chips | control plane + web | small |
| Installation webhooks to refresh the list | control plane | small |
| Per-session narrowed token minting and rotation | control plane + runner | small, reuses the runner host's App client |
| Credential helper in the golden image, seeded token | image + guest agent | small |

All of it lands in step 4 of the MVP order in note 07.

## Sources

- GitHub App installation flow and "All / Only select repositories":
  GitHub docs, "Installing your own GitHub App" and "Choosing permissions".
- Installation access tokens narrowed by `repositories` and
  `permissions`, one-hour lifetime: GitHub REST docs,
  "Create an installation access token for an app".
- Claude Code on the web's access model (OAuth for access, App for
  webhooks): <https://code.claude.com/docs/en/claude-code-on-the-web>
