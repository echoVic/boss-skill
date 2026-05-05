#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/../../packages/boss-cli/dist/bin/boss.js" runtime generate-summary "$@"
