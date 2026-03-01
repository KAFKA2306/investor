#!/usr/bin/env bash
set -u

ROOT_DIR="/home/kafka/finance/investor"
TS_DIR="$ROOT_DIR/ts-agent"
LOG_FILE="/tmp/jquants_warm_until_finish.log"

cd "$TS_DIR" || exit 1

set -a
source ../.env
set +a

from="${FROM:-2021-03-01}"
to="${TO:-$(date +%F)}"

echo "[start] $(date -Is) from=$from to=$to" >> "$LOG_FILE"

while true; do
  echo "[run] $(date -Is)" >> "$LOG_FILE"
  out=$(
    bun run jquants:warm-cache \
      --mode date \
      --from "$from" \
      --to "$to" \
      --date-order desc \
      --req-per-30sec 1 \
      --max-rate-limit-errors 2 2>&1
  )
  code=$?
  printf "%s\n" "$out" >> "$LOG_FILE"

  if [ "$code" -ne 0 ]; then
    echo "[warn] $(date -Is) exit=$code sleep60" >> "$LOG_FILE"
    sleep 60
    continue
  fi

  if printf "%s" "$out" | grep -q 'abortedByRateLimit": true'; then
    echo "[cooldown] $(date -Is) sleep310" >> "$LOG_FILE"
    sleep 310
    continue
  fi

  if printf "%s" "$out" | grep -q 'abortedByRateLimit": false'; then
    echo "[done] $(date -Is)" >> "$LOG_FILE"
    break
  fi

  echo "[warn] $(date -Is) no-marker sleep60" >> "$LOG_FILE"
  sleep 60
done
