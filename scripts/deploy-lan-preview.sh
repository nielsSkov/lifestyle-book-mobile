#!/usr/bin/env bash

set -euo pipefail

preview_host="${PREVIEW_HOST:-niels@192.168.0.172}"
remote_root="${PREVIEW_ROOT:-/home/niels/lifestyle-book-mobile}"
release="$(date -u +%Y%m%d%H%M%S)"
remote_release="$remote_root/releases/$release"

npm run build
ssh "$preview_host" "mkdir -p '$remote_release'"
tar -C dist -cf - . | ssh "$preview_host" "tar -C '$remote_release' -xf -"
ssh "$preview_host" "ln -sfn '$remote_release' '$remote_root/current'"

echo "LAN preview deployed to http://192.168.0.172:4173/"
