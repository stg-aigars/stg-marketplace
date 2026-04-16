# .claude/ directory

## Hook config

Claude Code reads hooks from `settings.json` in this directory. `settings.json` is globally gitignored (per `~/.gitignore`) — it's per-machine, not per-repo.

To set up hooks on a new machine:
1. Copy `settings.example.json` to `settings.json`
2. Hooks will load on next Claude Code session start

`hooks.json` was previously used but Claude Code does not read it. It was removed in commit 2ea0300.

## Hook scripts

- `hooks/lint-changed.sh` — runs ESLint on changed `.ts`/`.tsx` files under `src/` after Edit/Write. Advisory only (exit 0 always).
- `hooks/stg-standards-check.sh` — checks for CLAUDE.md convention violations (hardcoded hex colors, toLocaleString usage, AM/PM, float money, brand voice). Advisory only. See comments in the script for which CLAUDE.md sections each rule maps to.

## Other files

- `settings.local.json` — user-level overrides (gitignored)
- `projects/` — Claude Code project metadata (gitignored)
- `skills/` — custom skills (gitignored, lives in `~/.claude/skills/`)
- `mcp.json` — MCP server config (gitignored)
