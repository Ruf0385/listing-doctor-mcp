#!/usr/bin/env bash
# Listing Doctor MCP Server launcher
# Resolves to the package root and runs the server via tsx

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

exec npx tsx "$PACKAGE_DIR/src/index.ts" "$@"
