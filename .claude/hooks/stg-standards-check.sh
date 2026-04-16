#!/bin/bash
# PostToolUse hook: check written/edited files for STG standard violations
# Runs after Write and Edit tool calls
#
# Rules enforced here mirror CLAUDE.md conventions:
#   Hex colors → ## Design System Rules
#   Date formatting → ## Date & Time Formatting
#   Brand voice (exclamation marks in translations, "pre-loved") → ## Brand Voice
#   Integer cents → ## Code Style
# If CLAUDE.md rules change, update this script to match.

# Read JSON payload from stdin (Claude Code hooks interface)
INPUT=$(cat)

# Extract the file path — jq preferred, sed fallback
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi

# Only check source files (not configs, not node_modules, not .next)
if [[ ! "$FILE_PATH" =~ src/ ]]; then
  exit 0
fi

# Skip binary files
if [[ "$FILE_PATH" =~ \.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ ]]; then
  exit 0
fi

# Only read the file if it exists
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

CONTENT=$(cat "$FILE_PATH" 2>/dev/null)
WARNINGS=""

# 1. Hardcoded hex colors (skip tailwind config, token files, SVG attributes,
#    Tailwind arbitrary values like bg-[#xxx], and map library color props)
if [[ ! "$FILE_PATH" =~ (tailwind\.config|tokens)\. ]]; then
  HEX_MATCHES=$(echo "$CONTENT" | perl -ne 'print "$.:$_" if /#[0-9a-fA-F]{3,8}(?!-)/' | grep -v '// ok' | grep -vE 'fill="|stroke="|stop-color' | grep -vE '\[#[0-9a-fA-F]' | grep -vE '#[0-9]+[^a-fA-F]' | head -5)
  if [[ -n "$HEX_MATCHES" ]]; then
    WARNINGS+="⚠ Hardcoded hex color — use Tailwind design token classes instead:\n$HEX_MATCHES\n\n"
  fi
fi

# 2. toLocaleDateString / toLocaleTimeString / toLocaleString on dates
#    Exclude timezone conversion patterns (timeZone in same call)
DATE_MATCHES=$(echo "$CONTENT" | grep -nE 'toLocale(Date|Time)?String\(' | grep -v 'timeZone' | grep -v '// ok' | head -5)
if [[ -n "$DATE_MATCHES" ]]; then
  WARNINGS+="⚠ Use @/lib/date-utils instead of toLocale*String():\n$DATE_MATCHES\n\n"
fi

# 3. AM/PM time formats
AMPM_MATCHES=$(echo "$CONTENT" | grep -niE "(AM|PM)['\"]" | grep -v '// ok' | head -5)
if [[ -n "$AMPM_MATCHES" ]]; then
  WARNINGS+="⚠ Use 24-hour time format (no AM/PM) — see @/lib/date-utils:\n$AMPM_MATCHES\n\n"
fi

# 4. Exclamation marks in translation message files (JSON)
#    Note: JSX exclamation detection disabled — too many false positives from
#    JS negation operators (!isLoading, .filter(!...)). The JSON rule catches
#    the important case: hardcoded UI strings in translation files.
if [[ "$FILE_PATH" =~ \.json$ ]] && [[ "$FILE_PATH" =~ messages/ ]]; then
  EXCL_MATCHES=$(echo "$CONTENT" | grep -nE ':[[:space:]]*"[^"]*!"' | head -5)
  if [[ -n "$EXCL_MATCHES" ]]; then
    WARNINGS+="⚠ No exclamation marks in UI copy (brand voice):\n$EXCL_MATCHES\n\n"
  fi
fi

# 5. Float money values (common patterns like 12.99, price = 9.99)
MONEY_MATCHES=$(echo "$CONTENT" | grep -nE '(price|amount|fee|commission|cost|total)[[:space:]]*[=:][[:space:]]*[0-9]+\.[0-9]{2}' | grep -v '// ok' | head -5)
if [[ -n "$MONEY_MATCHES" ]]; then
  WARNINGS+="⚠ Monetary values must be INTEGER CENTS (1299 not 12.99):\n$MONEY_MATCHES\n\n"
fi

# 6. "used" or "secondhand"/"second-hand" in UI strings (should be "pre-loved")
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]]; then
  WORDING_MATCHES=$(echo "$CONTENT" | grep -nE '>[^<]*(used game|secondhand|second-hand)[^<]*<' | head -5)
  if [[ -n "$WORDING_MATCHES" ]]; then
    WARNINGS+="⚠ Use \"pre-loved\" instead of \"used\"/\"secondhand\" (brand voice):\n$WORDING_MATCHES\n\n"
  fi
fi

if [[ -n "$WARNINGS" ]]; then
  echo -e "STG Standards Check found issues in $FILE_PATH:\n" >&2
  echo -e "$WARNINGS" >&2
  # Exit 0 — warn but don't block (these are advisory)
  exit 0
fi
