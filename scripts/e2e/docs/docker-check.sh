#!/usr/bin/env bash
set -euo pipefail

NEW_API_BASE_URL="${NEW_API_BASE_URL:-http://127.0.0.1:9992}"

if [[ -n "${E2E_COMPOSE:-}" ]]; then
  read -r -a COMPOSE_CMD <<< "$E2E_COMPOSE"
else
  COMPOSE_CMD=(docker compose -f docker-compose.e2e.yml)
fi

"${COMPOSE_CMD[@]}" build new-api
"${COMPOSE_CMD[@]}" up -d new-api

deadline=$((SECONDS + 180))
until "${COMPOSE_CMD[@]}" ps new-api | grep -q '(healthy)'; do
  if (( SECONDS > deadline )); then
    "${COMPOSE_CMD[@]}" ps
    "${COMPOSE_CMD[@]}" logs --tail=200 new-api
    echo "new-api did not become healthy in time" >&2
    exit 1
  fi
  sleep 2
done

list_json="$(curl -fsS "${NEW_API_BASE_URL}/api/docs/list")"
printf '%s' "$list_json" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
assert payload["success"] is True, payload
assert any(item.get("slug") == "gpt-image-2" for item in payload["data"]), payload
'

"${COMPOSE_CMD[@]}" exec -T new-api sh -lc 'test ! -e /docs/guides/gpt-image-2.md'

echo "Docker docs embed check passed."
