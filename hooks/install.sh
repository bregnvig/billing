#!/usr/bin/env bash
# Installs the Loopme OS hook as a systemd user service (no root needed).
#
#   hooks/install.sh [--url URL] [--token TOKEN]   Install or update
#   hooks/install.sh --uninstall [--purge]         Remove (--purge also deletes config, queue and log)
#
# Get the token from Loopme: Settings > Devices > Add device. Without --token you're asked
# for it (input hidden), which keeps it out of your shell history.
#
# What it installs:
#   ~/.local/bin/loopme-hook                      the hook script
#   ~/.config/loopme/hook.env, token (mode 600)   where to send events, and this device's token
#   ~/.config/systemd/user/loopme-hook.service    runs `loopme-hook watch` with your desktop session

set -euo pipefail

DEFAULT_URL='http://127.0.0.1:5101/demo-billing/europe-west1/reportEvent'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/loopme"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/loopme"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="loopme-hook.service"

url="" token="" uninstall=false purge=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) url="${2:?--url needs a value}"; shift 2 ;;
    --token) token="${2:?--token needs a value}"; shift 2 ;;
    --uninstall) uninstall=true; shift ;;
    --purge) purge=true; shift ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

if $uninstall; then
  systemctl --user disable --now "$UNIT" 2>/dev/null || true
  rm -f "$UNIT_DIR/$UNIT" "$BIN_DIR/loopme-hook"
  systemctl --user daemon-reload
  if $purge; then
    rm -rf "$CONFIG_DIR" "$STATE_DIR"
    echo "Removed the Loopme hook, its config, queue and log."
  else
    echo "Removed the Loopme hook. Config and queue are kept in $CONFIG_DIR and $STATE_DIR (use --purge to delete)."
  fi
  echo "Remember to revoke this device in Loopme: Settings > Devices."
  exit 0
fi

missing=()
for tool in curl jq uuidgen flock gdbus systemctl timedatectl; do
  command -v "$tool" >/dev/null || missing+=("$tool")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing tools: ${missing[*]}. Install them first (e.g. omarchy pkg add ${missing[*]})." >&2
  exit 1
fi
if ! command -v omarchy-shell >/dev/null; then
  echo "Note: omarchy-shell not found, so lock/unlock won't be detected (login, logout, sleep and resume still are)." >&2
fi

# URL: flag > existing config > default (emulator)
if [[ -z "$url" && -f "$CONFIG_DIR/hook.env" ]]; then
  url="$(sed -n 's/^LOOPME_URL=//p' "$CONFIG_DIR/hook.env" | tr -d "'\"")"
fi
url="${url:-$DEFAULT_URL}"

# Token: flag > prompt > keep existing
if [[ -z "$token" ]]; then
  if [[ -t 0 ]]; then
    prompt="Device token from Loopme (Settings > Devices)"
    [[ -s "$CONFIG_DIR/token" ]] && prompt+=", or Enter to keep the current one"
    read -r -s -p "$prompt: " token
    echo
  fi
fi
if [[ -z "$token" && ! -s "$CONFIG_DIR/token" ]]; then
  echo "A device token is required. Add a device in Loopme (Settings > Devices) and pass --token or paste it when asked." >&2
  exit 1
fi
if [[ -n "$token" && ! "$token" =~ ^lpm_[A-Za-z0-9_-]{20,}$ ]]; then
  echo "That doesn't look like a Loopme device token (it starts with lpm_)." >&2
  exit 1
fi

install -d -m 700 "$CONFIG_DIR" "$STATE_DIR"
install -d "$BIN_DIR" "$UNIT_DIR"
install -m 755 "$SCRIPT_DIR/loopme-hook" "$BIN_DIR/loopme-hook"
printf "LOOPME_URL='%s'\n" "$url" >"$CONFIG_DIR/hook.env"
chmod 600 "$CONFIG_DIR/hook.env"
if [[ -n "$token" ]]; then
  (umask 077 && printf '%s' "$token" >"$CONFIG_DIR/token")
fi

cat >"$UNIT_DIR/$UNIT" <<EOF
[Unit]
Description=Loopme: report workday start/stop (login, lock, sleep)
PartOf=graphical-session.target
After=graphical-session.target

[Service]
ExecStart=$BIN_DIR/loopme-hook watch
Restart=on-failure
RestartSec=10
TimeoutStopSec=15

[Install]
WantedBy=graphical-session.target
EOF

echo "Checking the token against $url ..."
if ! "$BIN_DIR/loopme-hook" ping; then
  echo "Installed, but the check failed (see above). The service still starts and queues events until it works." >&2
fi

systemctl --user daemon-reload
systemctl --user enable "$UNIT" >/dev/null
systemctl --user restart "$UNIT"
echo "Installed. The service is running and starts with your desktop session."
echo "  Status:    loopme-hook status   (or: systemctl --user status $UNIT)"
echo "  Uninstall: $SCRIPT_DIR/install.sh --uninstall"
