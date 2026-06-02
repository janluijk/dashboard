#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs Node dependencies so linting/builds work as soon as the session starts.
set -euo pipefail

# Only run in the remote (web) environment; local setups manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: npm install is safe to re-run and benefits from container caching.
npm install
