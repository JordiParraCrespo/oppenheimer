---
"@oppenheimer/api": patch
---

Index the admin user search and the four foreign keys that had no index.

- The `pg_trgm` extension and `IDX_user_search_trgm`, a GIN over `user` `firstName`,
  `lastName` and `email`, so a search of three or more characters no longer
  scans the table.
- New `IDX_github_installation_installed_by`, `IDX_host_pairing_token_redeemed_host`
  (partial), `IDX_user_role_organization` (partial) and `IDX_user_role_role`.
