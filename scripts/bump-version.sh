#!/bin/bash
# bump-version.sh — Bumps the major version number across all ClaudePad config files
# Usage: ./scripts/bump-version.sh

set -euo pipefail
cd "$(dirname "$0")/.."

CURRENT=$(node -p "require('./package.json').version")
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
NEW="$((MAJOR + 1)).0.0"

echo "Bumping version: $CURRENT → $NEW"

# 1. package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json

# 2. tauri.conf.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" src-tauri/tauri.conf.json

# 3. Cargo.toml (only the package version line)
sed -i '' "s/^version = \"$CURRENT\"/version = \"$NEW\"/" src-tauri/Cargo.toml

echo "Updated: package.json, tauri.conf.json, Cargo.toml"
echo "New version: v$((MAJOR + 1))"
