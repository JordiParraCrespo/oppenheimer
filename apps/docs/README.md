# @oppenheimer/docs

The Docusaurus documentation site: getting started, the architecture guides,
the error catalog and the deployment tiers. What the root `README.md` and the
per-package docs say in short, this says in full, for a reader who is not in
the editor.

## Running it

```bash
pnpm --filter @oppenheimer/docs dev      # http://localhost:3003
pnpm --filter @oppenheimer/docs build
pnpm --filter @oppenheimer/docs lint
```

## Layout

```
docs/
├── getting-started/     # setup, project structure
├── architecture/        # backend, frontend, query keys, analytics, authorization
├── deployment/          # tier 1 (VPS) and tier 2 (Kubernetes)
├── tooling/             # CLI, MCP, permissions
└── errors.md            # the RFC 7807 error catalog, one row per code
sidebars.ts              # the navigation; wrap optional apps in oppenheimer markers
```

`docs/errors.md` is a contract: a new API error code needs a row here, and
the API's tests read it.

## Depends on / used by

Depends on nothing in the workspace. `apps/api`'s
`error-catalog-coverage.spec.ts` reads `docs/errors.md` and fails if a code is
undocumented, so that test is itself one of the paths
`scripts/starter/features.json` removes when the `docs` feature is pruned.

See [`AGENTS.md`](./AGENTS.md) for the conventions.
