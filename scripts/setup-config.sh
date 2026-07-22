#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

copy_if_missing() {
  example="$1"
  target="$2"

  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "[setup] created $target from example"
  fi
}

copy_if_missing "config/ai/beauty-filter.example.json" "config/ai/beauty-filter.json"
copy_if_missing "config/ai/gender-filter.example.json" "config/ai/gender-filter.json"
copy_if_missing "config/ai/excluded-names.example.json" "config/ai/excluded-names.json"
copy_if_missing "config/ai/espanol/analysis.example.json" "config/ai/espanol/analysis.json"
copy_if_missing "config/ai/espanol/chat.example.json" "config/ai/espanol/chat.json"
copy_if_missing "config/ai/espanol/openers.example.json" "config/ai/espanol/openers.json"
copy_if_missing "config/ai/espanol/personal-context.example.json" "config/ai/espanol/personal-context.json"
copy_if_missing "context/instagrams.example.json" "context/instagrams.json"

if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo "[setup] created .env from .env.example"
fi
