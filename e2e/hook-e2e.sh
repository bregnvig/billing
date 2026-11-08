#!/usr/bin/env bash
set -u
# End-to-end test of the Cloud Functions, Firestore rules and the OS hook script.
# Run with `npm run test:e2e` (starts its own emulators on the ports in firebase.e2e.json).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; HOOK="$ROOT/hooks/loopme-hook"
S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
AUTH=http://127.0.0.1:19199/identitytoolkit.googleapis.com/v1
FN=http://127.0.0.1:15101/demo-billing/europe-west1
FS='http://127.0.0.1:18180/v1/projects/demo-billing/databases/(default)/documents'
pass=0; fail=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1: expected '$3', got '$2'"; fail=$((fail+1)); fi; }
token() { curl -s "$AUTH/accounts:signInWithIdp?key=fake-api-key" -H 'Content-Type: application/json' -d "{\"postBody\":\"id_token={\\\"sub\\\":\\\"$2\\\",\\\"email\\\":\\\"$1\\\",\\\"email_verified\\\":true}&providerId=google.com\",\"requestUri\":\"http://localhost\",\"returnSecureToken\":true}" | jq -r .idToken; }
call() { curl -s "$FN/$1" -H 'Content-Type: application/json' -H "Authorization: Bearer $2" -d "{\"data\":$3}"; }
OWNER=$(token flemming@loopme.dk e2e-owner); OTHER=$(token someone@example.com e2e-other)

echo "Devices (callable functions)"
check "stranger can't create a device" "$(call createDevice "$OTHER" '{"name":"x"}' | jq -r .error.status)" "PERMISSION_DENIED"
check "empty name refused" "$(call createDevice "$OWNER" '{"name":"  "}' | jq -r .error.status)" "INVALID_ARGUMENT"
R=$(call createDevice "$OWNER" '{"name":"e2e-laptop"}'); DEVICE=$(jq -r .result.deviceId <<<"$R"); TOKEN=$(jq -r .result.token <<<"$R")
check "owner gets a lpm_ token" "$([[ $TOKEN == lpm_* ]] && echo yes)" "yes"

echo "Rules"
check "owner can read devices" "$(curl -s -o /dev/null -w '%{http_code}' "$FS/devices/$DEVICE" -H "Authorization: Bearer $OWNER")" "200"
check "owner can't read token hashes" "$(curl -s -o /dev/null -w '%{http_code}' "$FS/deviceTokens" -H "Authorization: Bearer $OWNER")" "403"
check "owner can't write devices" "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$FS/devices/$DEVICE" -H "Authorization: Bearer $OWNER" -H 'Content-Type: application/json' -d '{"fields":{"revokedAt":{"nullValue":null}}}')" "403"

echo "reportEvent HTTP"
check "GET refused" "$(curl -s -o /dev/null -w '%{http_code}' "$FN/reportEvent")" "405"
check "no token refused" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FN/reportEvent" -d '{}')" "401"
check "unknown token refused" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FN/reportEvent" -H "Authorization: Bearer lpm_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" -H 'Content-Type: application/json' -d '{"type":"ping"}')" "401"
check "bad body refused" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FN/reportEvent" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"type":"start","eventId":"x"}')" "400"

echo "Hook script"
export LOOPME_CONFIG_DIR="$S/config" LOOPME_STATE_DIR="$S/state"; mkdir -p "$LOOPME_CONFIG_DIR"
(umask 077; printf '%s' "$TOKEN" > "$LOOPME_CONFIG_DIR/token")
echo "LOOPME_URL='http://127.0.0.1:1/unreachable'" > "$LOOPME_CONFIG_DIR/hook.env"
"$HOOK" event start unlock
check "offline: event stays queued" "$(wc -l < "$LOOPME_STATE_DIR/queue.jsonl")" "1"
echo "LOOPME_URL='$FN/reportEvent'" > "$LOOPME_CONFIG_DIR/hook.env"
check "ping ok" "$("$HOOK" ping >/dev/null 2>&1 && echo ok)" "ok"
"$HOOK" flush
check "online: queue drained" "$(wc -l < "$LOOPME_STATE_DIR/queue.jsonl")" "0"
"$HOOK" event start unlock     # already running -> no-op
sleep 1
"$HOOK" event stop lock
"$HOOK" event stop sleep       # nothing running -> no-op

TODAY=$(date +%Y-%m-%d)
DOC=$(curl -s "$FS/timeEntries/${TODAY}__" -H "Authorization: Bearer $OWNER")
check "one period in today's unassigned entry" "$(jq '.fields.periods.arrayValue.values | length' <<<"$DOC")" "1"
check "period is closed" "$(jq -r '.fields.periods.arrayValue.values[0].mapValue.fields.end | keys[0]' <<<"$DOC")" "timestampValue"
check "source is hook" "$(jq -r '.fields.periods.arrayValue.values[0].mapValue.fields.source.stringValue' <<<"$DOC")" "hook"
RESULTS=$(curl -s "$FS/hookEvents?pageSize=50" -H "Authorization: Bearer $OWNER" | jq -r '[.documents[].fields | "\(.reason.stringValue):\(.result.stringValue)"] | sort | join(",")')
check "hookEvents results" "$RESULTS" "lock:stopped,sleep:no-running-period,unlock:already-running,unlock:started"
EV=$(curl -s "$FS/hookEvents?pageSize=50" -H "Authorization: Bearer $OWNER" | jq -r '[.documents[] | select(.fields.result.stringValue=="started")][0] | .name | split("/") | last')
BODY=$(jq -cn --arg id "$EV" --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" '{eventId:$id,type:"start",at:$at,tz:"Europe/Copenhagen",reason:"unlock"}')
check "resent eventId is a duplicate" "$(curl -s -X POST "$FN/reportEvent" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$BODY" | jq -r .result)" "duplicate"
check "lastSeenAt set" "$(curl -s "$FS/devices/$DEVICE" -H "Authorization: Bearer $OWNER" | jq -r '.fields.lastSeenAt | keys[0]')" "timestampValue"

echo "Revoke"
check "owner revokes" "$(call revokeDevice "$OWNER" "{\"deviceId\":\"$DEVICE\"}" | jq -r .result.ok)" "true"
check "revoked token refused by ping" "$("$HOOK" ping 2>&1 | grep -c refused)" "1"
"$HOOK" event start unlock
check "revoked: event parked in failed.jsonl" "$(wc -l < "$LOOPME_STATE_DIR/failed.jsonl")" "1"
check "revoked: queue not stuck" "$(wc -l < "$LOOPME_STATE_DIR/queue.jsonl")" "0"

echo "Watch mode (simulated lock screen)"
R=$(call createDevice "$OWNER" '{"name":"e2e-watch"}')
(umask 077; jq -jr .result.token <<<"$R" > "$LOOPME_CONFIG_DIR/token")
mkdir -p "$S/bin"; echo false > "$S/locked"
printf '#!/bin/sh\n[ "$1 $2" = "lock isLocked" ] && cat "%s/locked"\n' "$S" > "$S/bin/omarchy-shell"; chmod +x "$S/bin/omarchy-shell"
: > "$LOOPME_STATE_DIR/hook.log"
PATH="$S/bin:$PATH" LOOPME_POLL_SECONDS=1 "$HOOK" watch & W=$!
sleep 3; echo true > "$S/locked"; sleep 3; echo false > "$S/locked"; sleep 3
kill -TERM "$W"; wait "$W"
check "watch reports login, lock, unlock, logout" "$(grep -o 'sent [a-z]* ([a-z]*)' "$LOOPME_STATE_DIR/hook.log" | paste -sd,)" "sent start (login),sent stop (lock),sent start (unlock),sent stop (logout)"

echo; echo "$pass passed, $fail failed"
if ((fail > 0)); then echo "--- hook log"; cat "$LOOPME_STATE_DIR/hook.log"; exit 1; fi
