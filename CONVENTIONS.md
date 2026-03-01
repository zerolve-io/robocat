# Naming Conventions

## Cloudflare Resources

Pattern: `robocat-{resource}-{env}`

- Pages: `robocat-web-preview`, `robocat-web-prod`
- Worker: `robocat-api-preview`, `robocat-api-prod`
- D1: `robocat-db-dev`, `robocat-db-prod`
- KV: `robocat-kv-dev`, `robocat-kv-prod`
- R2: `robocat-assets-dev`, `robocat-assets-prod`

## Branches

- `main` — production
- `develop` — integration
- `feat/*` — features
- `fix/*` — bugfixes
- `chore/*` — tooling, CI, deps

## Commits (Conventional Commits)

- `feat:`, `fix:`, `chore:`, `docs:`, `perf:`, `refactor:`, `test:`
