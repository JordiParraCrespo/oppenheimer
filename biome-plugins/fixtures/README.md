# Biome plugin fixtures

One file per plugin in `../`, linted by the same override that runs the
plugins on the frontend. Every case that must be flagged carries a
`biome-ignore lint/plugin/<name>` comment; every case that must pass carries
none. `pnpm check:biome-plugins` lints this directory with
`--error-on-warnings`, so a pattern that stops matching leaves an unused
suppression and fails, and a pattern that starts matching a good case fails
too. Edit a plugin and its fixture together.
