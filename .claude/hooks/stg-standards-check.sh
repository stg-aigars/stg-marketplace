#!/bin/bash
# PostToolUse hook: check written/edited files for STG standard violations
# Runs after Write and Edit tool calls

# Extract the file path from tool input
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/"file_path"\s*:\s*"//;s/"$//')

# Only check source files (not configs, not node_modules, not .next)
if [[ ! "$FILE_PATH" =~ ^.*src/.* ]]; then
  exit 0
fi

WARNINGS=""

# Skip binary files
if [[ "$FILE_PATH" =~ \.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ ]]; then
  exit 0
fi

# Only read the file if it exists
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

CONTENT=$(cat "$FILE_PATH" 2>/dev/null)

# 1. Hardcoded hex colors (skip tailwind config and token files)
if [[ ! "$FILE_PATH" =~ (tailwind\.config|tokens)\. ]]; then
  HEX_MATCHES=$(echo "$CONTENT" | grep -nP '#[0-9a-fA-F]{3,8}(?!-)' | grep -v '// ok' | grep -v 'eslint' | head -5)
  if [[ -n "$HEX_MATCHES" ]]; then
    WARNINGS+="⚠ Hardcoded hex color — use Tailwind design token classes instead:\n$HEX_MATCHES\n\n"
  fi
fi

# 2. toLocaleDateString / toLocaleTimeString / toLocaleString on dates
DATE_MATCHES=$(echo "$CONTENT" | grep -nP 'toLocale(Date|Time)?String\(' | head -5)
if [[ -n "$DATE_MATCHES" ]]; then
  WARNINGS+="⚠ Use @/lib/date-utils instead of toLocale*String():\n$DATE_MATCHES\n\n"
fi

# 3. AM/PM time formats
AMPM_MATCHES=$(echo "$CONTENT" | grep -nP "(?i)(AM|PM)['\"]" | grep -v '// ok' | head -5)
if [[ -n "$AMPM_MATCHES" ]]; then
  WARNINGS+="⚠ Use 24-hour time format (no AM/PM) — see @/lib/date-utils:\n$AMPM_MATCHES\n\n"
fi

# 4. Exclamation marks in UI strings (JSX text or translation strings)
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]]; then
  EXCL_MATCHES=$(echo "$CONTENT" | grep -nP '>[^<]*!(?!</)' | grep -v 'eslint' | grep -v '//' | head -5)
  if [[ -n "$EXCL_MATCHES" ]]; then
    WARNINGS+="⚠ No exclamation marks in UI copy (brand voice):\n$EXCL_MATCHES\n\n"
  fi
fi
if [[ "$FILE_PATH" =~ \.json$ ]] && [[ "$FILE_PATH" =~ messages/ ]]; then
  EXCL_MATCHES=$(echo "$CONTENT" | grep -nP ':\s*"[^"]*!"' | head -5)
  if [[ -n "$EXCL_MATCHES" ]]; then
    WARNINGS+="⚠ No exclamation marks in UI copy (brand voice):\n$EXCL_MATCHES\n\n"
  fi
fi

# 5. Float money values (common patterns like 12.99, price = 9.99)
MONEY_MATCHES=$(echo "$CONTENT" | grep -nP '(price|amount|fee|commission|cost|total)\s*[=:]\s*\d+\.\d{2}' | head -5)
if [[ -n "$MONEY_MATCHES" ]]; then
  WARNINGS+="⚠ Monetary values must be INTEGER CENTS (1299 not 12.99):\n$MONEY_MATCHES\n\n"
fi

# 6. "used" or "secondhand"/"second-hand" in UI strings (should be "pre-loved")
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]]; then
  WORDING_MATCHES=$(echo "$CONTENT" | grep -nP '>[^<]*(used game|secondhand|second-hand)[^<]*<' | head -5)
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
