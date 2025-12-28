#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/chat-multi-ai"
BUILD_DIR="$APP_DIR/build/chrome-mv3-prod"
OUT_ZIP="$ROOT_DIR/ChatMultiAI-extension.zip"
STAGE_DIR="$ROOT_DIR/.context/release-staging"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it first: https://pnpm.io/installation" >&2
  exit 1
fi

pnpm -C "$APP_DIR" install
pnpm -C "$APP_DIR" build

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/ChatMultiAI"
cp -R "$BUILD_DIR/." "$STAGE_DIR/ChatMultiAI/"

(
  cd "$STAGE_DIR"
  zip -r -X "$OUT_ZIP" "ChatMultiAI" >/dev/null
)

echo "Wrote $OUT_ZIP"
