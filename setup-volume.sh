#!/bin/sh
# Ensure the persistent volume is writable by the unprivileged `node` user,
# then hand off to the app. A mounted volume replaces the image's /data, so
# build-time chown is not enough; ownership must be fixed at container start.
set -e

DATA_DIR="${JOURNAL_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  chmod 755 "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Already unprivileged: best effort, the app reports a clear error if unwritable.
mkdir -p "$DATA_DIR" 2>/dev/null || echo "setup-volume: cannot create $DATA_DIR" >&2
exec "$@"
