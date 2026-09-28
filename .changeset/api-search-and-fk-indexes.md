---
"@oppenheimer/api": patch
---

Index the admin user search and the four foreign keys that had no index.

- Migration `1790880000000-AddUserSearchTrigramIndex` creates the `pg_trgm`
  extension and `IDX_user_search_trgm`, a GIN over `user` `firstName`,
  `lastName` and `email`, so a search of three or more characters no longer
  scans the table.
- Migration `1790890000000-IndexUnbackedForeignKeys` adds
  `IDX_github_installation_installed_by`, `IDX_host_pairing_token_redeemed_host`
  (partial), `IDX_user_role_organization` (partial) and `IDX_user_role_role`.
- On a large database, run `apps/api/db/ops/1790880000000-user-search-trigram-index.sql`
  and `apps/api/db/ops/1790890000000-foreign-key-indexes.sql` before deploying;
  the migrations refuse to build indexes on a large table inside the boot
  transaction.
