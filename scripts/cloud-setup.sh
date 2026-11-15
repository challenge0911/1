#!/usr/bin/env bash
# Install script for a Codex Cloud environment.
# Place this file at <repo>/scripts/cloud-setup.sh, then set the environment's
# Install script field to:  bash scripts/cloud-setup.sh
#
# The setup phase has network access; the agent phase does not by default.
# Everything installed here stays inside the OpenAI cloud container.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Project dependencies.
if [ -f package-lock.json ]; then
  npm ci
elif [ -f pnpm-lock.yaml ]; then
  corepack enable
  pnpm install --frozen-lockfile
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile
else
  npm install
fi

# 2. Make sure a Playwright runtime is present in the cloud container.
if ! node -e "require.resolve('playwright')" >/dev/null 2>&1 &&
   ! node -e "require.resolve('@playwright/test')" >/dev/null 2>&1; then
  npm install --save-dev playwright
fi

# 3. Headless Chromium plus its Linux host libraries.
#    Requires cdn.playwright.dev and the OS package sources in the
#    environment's network allowlist during setup.
npx playwright install --with-deps chromium

mkdir -p artifacts
echo "cloud browser setup done"
