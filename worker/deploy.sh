#!/usr/bin/env bash
# Worker'ı VPS'e gönderir ve yeniden başlatır. Kullanım: worker/deploy.sh [ssh-host]
# VPS'te /docker/acikbazaar-agents/.env önceden olmalı (worker/.env.example'a bak).
set -euo pipefail
HOST="${1:-careerops-vps}"
DIR=/docker/acikbazaar-agents
cd "$(dirname "$0")/.."
rsync -az --delete --exclude .env \
  package.json package-lock.json tsconfig.json .dockerignore types lib worker \
  "$HOST:$DIR/"
ssh "$HOST" "cd $DIR && cp worker/docker-compose.yml docker-compose.yml && docker compose up -d --build && docker compose ps"
