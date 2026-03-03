#!/bin/bash
# bump-version.sh — Bumps version across all ClaudePad config files
# Usage: ./scripts/bump-version.sh [major|minor]
#
# Major bump: 1.2.3 → 2.0.0  (new features, UI overhauls, breaking changes)
# Minor bump: 1.2.3 → 1.2.4  (bug fixes, tweaks, small improvements)

set -euo pipefail
cd "$(dirname "$0")/.."

TYPE="${1:-minor}"
CURRENT=$(node -p "require('./package.json').version")

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Usage: $0 [major|minor]"
    exit 1
    ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"

echo "Bumping version: $CURRENT → $NEW ($TYPE)"

# 1. package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json

# 2. tauri.conf.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" src-tauri/tauri.conf.json

# 3. Cargo.toml (only the package version line)
sed -i '' "s/^version = \"$CURRENT\"/version = \"$NEW\"/" src-tauri/Cargo.toml

echo "Updated: package.json, tauri.conf.json, Cargo.toml"
echo "New version: v$NEW"
