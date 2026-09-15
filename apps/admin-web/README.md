# @oppenheimer/admin-web

The browser control plane for Oppenheimer. It is restricted to Better Auth `admin`
and `superadmin` accounts and currently manages users, application roles, and
permission grants.

```bash
pnpm --filter @oppenheimer/admin-web dev
```

Development runs on `http://localhost:3003`. Set `ADMIN_FRONTEND_URL` to its
public origin in deployed environments.

The control plane has no registration route. It accepts existing Better Auth
accounts whose platform role contains `admin` or `superadmin`; application
roles assigned here govern access inside consumer products.
