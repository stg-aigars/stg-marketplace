# Coolify API — empirical endpoint notes

Coolify v4 exposes a REST API at `/api/v1`. Public docs cover Applications, Deployments, Databases, Servers, Services, Teams. **Some endpoints used in real operations are NOT in the public OpenAPI spec** but are functional. This file records what we've verified empirically against our production Coolify instance (`v4.0.0-beta.473`).

> If the public docs add or change endpoints later, the notes here may drift. Treat this as point-in-time empirical capture, not authoritative reference. Verify against the live API before depending on anything below.

## Connection

- **Base URL**: `http://37.27.24.207:8000/api/v1` (HTTP — Coolify dashboard runs unencrypted; the API does too. Don't expose to the public internet.)
- **Auth**: `Authorization: Bearer <token>`
- **Token creation**: Coolify UI → **Keys & Tokens** → **API tokens** → "Add new". Scope `root` works for everything; finer scopes available.
- **IP allowlist**: Settings → Advanced → API Access. When non-empty, only the listed IPs (CIDR or bare IP) can hit the API even with a valid token. Leave empty (or `0.0.0.0/0`) to allow any source. Production posture: restrict to operator IPs.

## Verified endpoints (2026-05-13)

### Sanity check / token verification

**`GET /api/v1/version`** — returns server version info. Doesn't require any specific scope. Useful as a "does the token work" probe.

```bash
curl -sS -H "Authorization: Bearer <token>" http://37.27.24.207:8000/api/v1/version
```

Returns 200 with version JSON. 401 if token invalid; 403 if IP blocked.

### Applications

**`GET /api/v1/applications`** — list all applications across all projects.

Returns an array of full application objects. Each entry includes:
- `uuid` (Coolify internal ID, used as path param elsewhere)
- `name`, `description`, `fqdn` (the configured domains, comma-separated string)
- `build_pack` (`dockerimage` for pull-mode, `dockerfile` / `nixpacks` / etc. for build-from-source)
- `docker_registry_image_name`, `docker_registry_image_tag` (set when build_pack = dockerimage)
- `git_repository`, `git_branch`, `dockerfile_location` (set when build-from-source)
- `ports_exposes`, `health_check_*`, `limits_*` (runtime config)
- `status` (e.g., `running:healthy`, `exited:unhealthy`)
- `custom_labels` (base64-encoded Traefik labels — decode to see the actual routing rules)
- Nested `destination` object with full server + proxy config (large; usually you ignore it)

**`GET /api/v1/applications/<uuid>`** — single application detail. Same shape as one element from the list.

### Scheduled tasks (UNDOCUMENTED but functional)

The public OpenAPI spec does NOT list endpoints for scheduled tasks. They exist and work.

**`GET /api/v1/applications/<uuid>/scheduled-tasks`** — list scheduled tasks for an application.

Returns an array of objects:

```json
[
  {
    "uuid": "szfeolrv0b8nw49q088m8erl",
    "name": "auction-ending-soon",
    "command": "curl -s -X POST -H \"Authorization: Bearer ${CRON_SECRET}\" http://localhost:3000/api/cron/auction-ending-soon",
    "container": "",
    "enabled": true,
    "frequency": "*/5 * * * *",
    "timeout": 300,
    "created_at": "2026-04-07T08:09:51.000000Z",
    "updated_at": "2026-04-07T08:09:51.000000Z"
  }
]
```

Field notes:
- `frequency` accepts both standard cron syntax (`*/5 * * * *`) and Coolify shortcuts (`daily`, `weekly`, `monthly`)
- `command` runs inside the application's container (where `${CRON_SECRET}` resolves via container env vars); `http://localhost:3000` is the in-container marketplace port
- `container` empty = default container for the application
- `timeout` is seconds (default 300)
- `enabled: false` keeps the task definition but skips scheduling

**`POST /api/v1/applications/<uuid>/scheduled-tasks`** — create a new scheduled task.

Request body (JSON):

```json
{
  "name": "monthly-vat-close",
  "command": "curl -s -X POST -H \"Authorization: Bearer ${CRON_SECRET}\" http://localhost:3000/api/cron/monthly-vat-close",
  "frequency": "0 1 1 * *",
  "container": "",
  "enabled": true,
  "timeout": 300
}
```

Response: 201 Created with the created task object including its `uuid`.

Used in production: 2026-05-13, all 18 scheduled tasks migrated from the old git-built application to the new Docker Image application via a Python script that POSTed each task sequentially (script in conversation history, not committed). Plus the new `monthly-vat-close` cron from PR C.

### Not yet verified, expected to exist (per public docs / source code)

- `PATCH /api/v1/applications/<uuid>/scheduled-tasks/<task-uuid>` — update an existing task
- `DELETE /api/v1/applications/<uuid>/scheduled-tasks/<task-uuid>` — remove a task
- `GET /api/v1/applications/<uuid>/envs` — list environment variables (likely returns references, not plaintext values, by design)
- `POST /api/v1/applications/<uuid>/start`, `/stop`, `/restart`
- `POST /api/v1/applications/<uuid>/deploy` — trigger a deploy
- `GET /api/v1/deployments` — list recent deployments

Verify before depending on any of these.

## Operational patterns

### Bulk scheduled-task migration (proven 2026-05-13)

When migrating tasks between two apps (e.g., during the PR C resolution sequence where a new "Docker Image" type app replaced a git-built one):

1. `GET /api/v1/applications/<old-uuid>/scheduled-tasks` to retrieve full list with all fields
2. For each task: `POST /api/v1/applications/<new-uuid>/scheduled-tasks` with `{name, command, frequency, container, enabled, timeout}` (drop `uuid`, `created_at`, `updated_at` — those are server-generated)
3. Verify count via `GET /api/v1/applications/<new-uuid>/scheduled-tasks`

Idempotency caveat: POST creates a new task each time it's called, even with the same name. Run twice = duplicate tasks. Use list-and-filter before re-POSTing if there's any chance the script is re-run.

### Token rotation

Coolify API tokens don't have a UI-side expiry. Operational discipline:

- Calendar reminder to rotate annually (current token `claude-automation` created 2026-05-13, rotate ~2027-05-13)
- On rotation: delete old token in dashboard, create new, update any stored references (Bitwarden)
- Tokens are bearer credentials — losing one means revoking and re-issuing

## Future automation candidates

Operations currently done via the dashboard that could move to API once we trust the endpoints:

- Trigger redeploy after GHA pushes a new image to GHCR (the manual click after every push to main)
- List recent deployments + their status (currently visible only in dashboard)
- Bulk env var inspection across apps for drift detection between staging/production (no staging today, but relevant when one exists)
- Application stop/start during cutover stages (instead of UI button clicks)

These are deferred until either a real need surfaces or operational pain accumulates.
