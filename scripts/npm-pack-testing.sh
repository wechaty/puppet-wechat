#!/usr/bin/env bash
set -e

npm run dist
npm run pack

TMPDIR="/tmp/npm-pack-testing.$$"
mkdir "$TMPDIR"
mv *-*.*.*.tgz "$TMPDIR"
cp tests/fixtures/smoke-testing.ts "$TMPDIR"

cd $TMPDIR
npm init -y
npm install *-*.*.*.tgz \
  @types/lru-cache \
  @types/node \
  @types/normalize-package-data \
  @types/promise-retry \
  brolog \
  file-box \
  hot-import \
  lru-cache \
  memory-card \
  normalize-package-data \
  state-switch \
  typescript \
  wechaty-puppet \
  wechat4u \
  qr-image \
  promise-retry \
  watchdog \

./node_modules/.bin/tsc \
  --esModuleInterop \
  --lib esnext \
  --noEmitOnError \
  --noImplicitAny \
  --target es6 \
  --module commonjs \
  smoke-testing.ts

node smoke-testing.js
