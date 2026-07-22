#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[install] installing npm dependencies..."
npm install

echo "[install] setting up local config from examples..."
sh scripts/setup-config.sh

echo "[install] checking playwright chromium..."
node --import tsx -e "
import { runDependencyBootstrap } from './src/infrastructure/bootstrap/dependency-bootstrap.ts';
await runDependencyBootstrap();
"

echo ""
echo "[install] done - run: npm start"
