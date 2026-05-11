#!/usr/bin/env bash
set -euo pipefail

ports=(3000 3001)
declare -A pids=()

add_pid() {
  local pid="$1"
  [[ -z "$pid" ]] && return
  [[ "$pid" == "$$" || "$pid" == "$PPID" ]] && return
  [[ "$pid" =~ ^[0-9]+$ ]] || return
  pids["$pid"]=1
}

for port in "${ports[@]}"; do
  if command -v lsof >/dev/null 2>&1; then
    while read -r pid; do add_pid "$pid"; done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    for pid in $(fuser -n tcp "$port" 2>/dev/null || true); do add_pid "$pid"; done
  fi
done

patterns=(
  'vite --port=3000'
  'tsx watch server/index.ts'
  'concurrently.*npm run frontend.*npm run backend'
  'npm run dev'
)

for pattern in "${patterns[@]}"; do
  while read -r pid; do add_pid "$pid"; done < <(pgrep -f "$pattern" 2>/dev/null || true)
done

if [[ ${#pids[@]} -eq 0 ]]; then
  echo "No dev services found on ports 3000/3001."
  exit 0
fi

echo "Closing dev services: ${!pids[*]}"
kill -TERM "${!pids[@]}" 2>/dev/null || true
sleep 1

for pid in "${!pids[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
done

echo "Closed dev services."
