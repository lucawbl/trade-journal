#!/bin/sh
# Runs as root at container startup. Railway mounts the volume at /data after
# the image is built, so ownership must be fixed here rather than in the Dockerfile.
set -e

DATA_DIR="${JOURNAL_DATA_DIR:-/data}"

echo "[entrypoint] Running as $(id -un) (uid=$(id -u))"

echo "[entrypoint] Ensuring $DATA_DIR exists"
mkdir -p "$DATA_DIR"

echo "[entrypoint] Fixing ownership of $DATA_DIR and /app to node:node"
chown -R node:node "$DATA_DIR" /app

echo "[entrypoint] Fixing permissions of $DATA_DIR and /app to 755"
chmod -R 755 "$DATA_DIR" /app

echo "[entrypoint] Verifying $DATA_DIR is writable by node"
if gosu node:node touch "$DATA_DIR/.write-test"; then
  rm -f "$DATA_DIR/.write-test"
  echo "[entrypoint] $DATA_DIR is writable"
else
  echo "[entrypoint] ERROR: $DATA_DIR is not writable by node" >&2
  ls -ld "$DATA_DIR" >&2
  exit 1
fi

ls -ld "$DATA_DIR" /app

echo "[entrypoint] Starting Next.js as node"
exec gosu node:node node apps/web/server.js
