#!/usr/bin/env bash
set -e

VERSION=$(npx pkg-jq -r .version)

if npx --package @chatie/semver semver-is-prod $VERSION; then
  NPM_TAG=latest
else
  NPM_TAG=next
fi

npm run dist
npm run pack

TMPDIR="/tmp/npm-pack-testing.$$"
mkdir "$TMPDIR"
mv *-*.*.*.tgz "$TMPDIR"
cp tests/fixtures/smoke-testing.ts "$TMPDIR"

cd $TMPDIR
npm init -y
npm install *-*.*.*.tgz \
  @chatie/tsconfig \
  @types/normalize-package-data \
  @types/promise-retry \
  @types/puppeteer \
  brolog \
  file-box \
  memory-card \
  normalize-package-data \
  rxjs \
  rx-queue \
  state-switch \
  "wechaty-puppet@$NPM_TAG" \
  qr-image \
  promise-retry \
  watchdog \

./node_modules/.bin/tsc \
  --esModuleInterop \
  --lib dom,esnext \
  --noEmitOnError \
  --noImplicitAny \
  --target es6 \
  --module commonjs \
  smoke-testing.ts

node smoke-testing.js
