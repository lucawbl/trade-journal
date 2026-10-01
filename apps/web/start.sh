#!/bin/sh
# Container entrypoint. Railway mounts volumes owned by root, which hides the
# ownership set at build time. Fix ownership at runtime, then drop privileges.
set -e

DATA_DIR="${JOURNAL_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown node:node "$DATA_DIR"
  chmod 755 "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Already unprivileged (e.g. local run): nothing to fix, just start the server.
exec "$@"
