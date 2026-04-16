#!/bin/bash
# PostToolUse hook: run ESLint on changed .ts/.tsx files under src/
# Advisory only — exit 0 always, surfaces issues via stdout

# Read JSON payload from stdin (Claude Code hooks interface)
INPUT=$(cat)

# Try jq first (fast, reliable), fall back to sed
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi

# Skip if no file path, not TypeScript, or not under src/
[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]] && exit 0
[[ "$FILE_PATH" != *src/* ]] && exit 0
[[ ! -f "$FILE_PATH" ]] && exit 0

# Run ESLint on the single file — pnpm exec avoids npx resolution overhead
pnpm exec eslint --no-warn-ignored "$FILE_PATH" 2>&1 | head -20

# Always exit 0 — this hook is advisory, not blocking
exit 0
