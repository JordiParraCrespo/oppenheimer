# Releases and deployment artifacts

Decided on 2026-10-01. Web, API and runner use independent semantic versions.
GitHub builds the artifacts; a deployment downloads them rather than building
on the server. Automatic deployments are the next step.

| Component | Version source | Git tag | Distribution |
| --- | --- | --- | --- |
| API | `apps/api/package.json` | `api-vX.Y.Z` | GHCR image, Linux amd64 |
| Web | `apps/web/package.json` | `web-vX.Y.Z` | GHCR nginx image, Linux amd64 |
| Runner | `apps/runner/package.json` | `runner-vX.Y.Z` | GitHub Release binaries, macOS/Linux amd64/arm64 |

Beta tags have the suffix `-beta.N`, matching the package version exactly.
API, web and runner versions need not match. A release does not imply that
every combination is compatible: API changes must allow currently supported
runners and the previous web build during a rollout. Breaking protocol changes
need a compatibility plan before release.

## Version and build

1. Add a changeset for each app whose shipped behavior changes. Include the
   affected apps when a shared-package change alters them; the Go dependency
   graph is expressed through development dependencies, so do not assume an
   automatic transitive bump covers every runner change.
2. Merge the Changesets version PR. `privatePackages.version` is explicitly
   enabled; apps stay private and are not published to npm. Versions and
   changelogs are independent (`fixed` and `linked` are empty).
3. Choose the merged commit, create its component tag, and push it. For example,
   after the API package version becomes `0.3.0`:

   ```sh
   git tag api-v0.3.0 <merged-commit-sha>
   git push origin api-v0.3.0
   ```

   Tags start the **Release artifacts** workflow. You can also run it manually
   with an existing tag:

   ```sh
   gh workflow run release-artifacts.yml --ref main -f tag=api-v0.3.0
   ```

The tag must match the component's package version and point to a commit on
`main`'s history. The workflow resolves it to a SHA and calls the existing CI
workflow to run `pnpm ci:local --all` on that exact commit. PR validation remains
local. Release validation uses the same pipeline; it adds no second test suite.

After validation, the workflow reserves a draft release, builds artifacts from
the validated SHA, uploads `release.json` and the CI report, then publishes the
release. Beta releases are marked prereleases. Component releases do not compete
for GitHub's repository-wide Latest designation.

API and web images use their own version tags:
`ghcr.io/<owner>/<repo>/oppenheimer-api:X.Y.Z` and
`ghcr.io/<owner>/<repo>/oppenheimer-web:X.Y.Z`. The manifest records the full
commit and immutable image digest. Release builds never update `latest`.
Scheduled CI still publishes development images under its existing SHA and
`latest` tags; those are not production release references.

A reserved version is never rebuilt or overwritten. If a build or publication
fails after draft reservation, leave that draft for diagnosis and release a new
version. GitHub Actions reruns and manual dispatches refuse existing releases,
including drafts. Restrict component tag creation/deletion through repository
rulesets; workflow checks alone do not prevent an administrator changing tags
or registry artifacts.

## Pull for deployment

Download the chosen API and web releases' `release.json`. Put each `image` value
in the root `.env` as `API_IMAGE` or `WEB_IMAGE`. Production Compose requires
explicit image references. The selected versions can differ.

```sh
docker login ghcr.io
docker compose --env-file .env -f docker/docker-compose.prod.yml pull api web
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d api web
```

The server needs package read access if GHCR packages are private. Check API
readiness and web behavior after the rollout. Database migrations and rollback
compatibility must be planned before replacing the API image; pulling an older
image does not undo database changes.

The web image uses same-origin `/api`, proxied by nginx to the API service.
This lets the same image run in staging and production. The current release
build uses the Dockerfile's default public Vite settings; analytics is disabled
without a build-time key. Any future build-time configuration becomes part of
the artifact and must be recorded before enabling automatic promotion.

## Runner activation

Set `RUNNER_RELEASE_PUBLIC_KEYS` and `RUNNER_RELEASE_BASE_URL` as GitHub repository
variables before the first runner release. The base URL must be the actual host
where the archives and channel files will be served. `RUNNER_MIN_SUPPORTED` is
optional. The workflow refuses to release binaries without trusted public keys.

GitHub builds and uploads four archives, `SHA256SUMS`, the stamped `install.sh`,
and the unsigned `stable.json` or `beta.json`. It smoke-tests the Linux amd64
binary. The private signing key never enters GitHub Actions.

On the machine holding the offline key:

```sh
gh release download runner-v0.2.0 --dir runner-release
scripts/runner/sign-release.sh runner-release/stable.json /path/to/release.key
gh release upload runner-v0.2.0 runner-release/stable.json.sig
```

Publish the archives and installer to the configured release host, then activate
the channel manifest and signature together. Hosts cannot install or update from
an unsigned manifest. Set the deployment's `RUNNER_INSTALL_SHA256` to the stamped
installer's digest. A GitHub release alone does not activate host updates.

## GitHub setup and later deployment automation

The existing `gha-vm` runner must provide Docker/Buildx, GitHub CLI, jq, and the
tooling needed by `ci:local`, including the services used by integration tests.
Enable Actions' package writes and release writes. The existing Changesets
workflow also needs permission to create pull requests.

Automatic deployment will consume these manifests, serialize updates per
environment, check health, and record the versions actually deployed. Staging
can run automatically; production initially uses an explicit promotion. Both
consume the same image digest. Deployment credentials, destinations, migration
handling and recovery are configured when that work begins.
