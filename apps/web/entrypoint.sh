#!/bin/sh
set -e

# Railway mounts the volume at /data after the image is built, replacing any
# permissions set at build time. Fix ownership at startup, then drop privileges.
DATA_DIR="${JOURNAL_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  chmod 755 "$DATA_DIR"
  exec su-exec node "$@"
fi

# Already non-root (e.g. overridden user); just run the command.
exec "$@"
