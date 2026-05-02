#!/usr/bin/env bash
# Mimi's Dance Wonderland - Proxmox LXC installer
#
# Run this on your Proxmox PVE host (as root). It will:
#   1. Pick a free VMID and download the Ubuntu 24.04 LXC template if needed
#   2. Create an unprivileged LXC with Docker-friendly features (nesting+keyctl)
#   3. Bind-mount your dance video library into the container at /videos (ro)
#   4. Boot the container, install Docker, clone the repo, and start the app
#   5. Print the URL when it's done
#
# One-command run:
#   bash <(curl -fsSL https://raw.githubusercontent.com/tnargwoxow/homelab-apps/claude/dance-class-streaming-app-urVJK/apps/dance-classes/scripts/install-proxmox.sh)
#
# Configurable via env vars (all optional):
#   VIDEOS_HOST_PATH   Host path to your video library (will be prompted if missing)
#   VMID               Container ID (default: next free starting at 200)
#   HOSTNAME           Container hostname (default: mimis-dance-wonderland)
#   STORAGE            Container disk storage (default: auto-detected)
#   DISK_SIZE          Root disk size GiB (default: 8)
#   MEMORY             RAM MiB (default: 1024)
#   CORES              vCPU cores (default: 2)
#   BRIDGE             Network bridge (default: vmbr0)
#   GIT_URL            Repo to clone (default: tnargwoxow/homelab-apps)
#   GIT_BRANCH         Branch to deploy (default: claude/dance-class-streaming-app-urVJK)
#   APP_PORT           Host-side app port (default: 8080)

set -euo pipefail

# ---------- helpers ----------
say()  { printf '\033[1;35m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }
ask()  { local p="$1" def="${2:-}" v; if [ -t 0 ]; then read -rp "$p${def:+ [$def]}: " v || true; fi; printf '%s' "${v:-$def}"; }

# ---------- preflight ----------
[ "$(id -u)" -eq 0 ] || die "run as root on the Proxmox host"
need pveversion
need pct
need pvesm

PVE_VER=$(pveversion -v 2>/dev/null | awk -F'[: /]+' '/^proxmox-ve/{print $2}' || true)
say "Proxmox VE detected${PVE_VER:+ ($PVE_VER)}"

# ---------- inputs ----------
VIDEOS_HOST_PATH="${VIDEOS_HOST_PATH:-}"
if [ -z "$VIDEOS_HOST_PATH" ]; then
  VIDEOS_HOST_PATH=$(ask "Path on this host to your dance video library")
fi
[ -n "$VIDEOS_HOST_PATH" ] || die "VIDEOS_HOST_PATH is required"
[ -d "$VIDEOS_HOST_PATH" ] || die "videos path does not exist: $VIDEOS_HOST_PATH"
VIDEOS_HOST_PATH=$(readlink -f "$VIDEOS_HOST_PATH")
ok "videos: $VIDEOS_HOST_PATH"

# Pick next free VMID >= 200 unless caller set one
auto_vmid() {
  local existing free=200
  existing=$( { qm list 2>/dev/null | awk 'NR>1{print $1}'; pct list 2>/dev/null | awk 'NR>1{print $1}'; } | sort -n | uniq )
  while echo "$existing" | grep -qx "$free"; do free=$((free+1)); done
  echo "$free"
}
VMID="${VMID:-$(auto_vmid)}"
HOSTNAME="${HOSTNAME:-mimis-dance-wonderland}"
DISK_SIZE="${DISK_SIZE:-8}"
MEMORY="${MEMORY:-1024}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
APP_PORT="${APP_PORT:-8080}"
GIT_URL="${GIT_URL:-https://github.com/tnargwoxow/homelab-apps.git}"
GIT_BRANCH="${GIT_BRANCH:-claude/dance-class-streaming-app-urVJK}"

# Pick first storage that supports rootdir if not specified
auto_storage() {
  pvesm status -content rootdir 2>/dev/null | awk 'NR>1 && $3=="active"{print $1; exit}'
}
STORAGE="${STORAGE:-$(auto_storage)}"
[ -n "$STORAGE" ] || die "no rootdir-capable storage found; pass STORAGE=<name>"

# Template selection
TEMPLATE_STORAGE=""
for s in local $(pvesm status -content vztmpl 2>/dev/null | awk 'NR>1{print $1}'); do
  if pvesm list "$s" 2>/dev/null | grep -q "vztmpl"; then TEMPLATE_STORAGE="$s"; break; fi
done
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"

TEMPLATE_NAME="ubuntu-24.04-standard"
TEMPLATE_FILE=$(pveam available 2>/dev/null | awk -v n="$TEMPLATE_NAME" '$2 ~ n {print $2}' | sort -V | tail -1)
[ -n "$TEMPLATE_FILE" ] || die "could not find $TEMPLATE_NAME in pveam catalog (try: pveam update)"

if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE_FILE"; then
  say "downloading template $TEMPLATE_FILE to $TEMPLATE_STORAGE..."
  pveam update >/dev/null
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_FILE"
fi
TEMPLATE_REF="$TEMPLATE_STORAGE:vztmpl/$TEMPLATE_FILE"
ok "template: $TEMPLATE_REF"

cat <<EOF

========================================================
  Mimi's Dance Wonderland - Proxmox LXC installer
========================================================
  VMID:        $VMID
  Hostname:    $HOSTNAME
  Storage:     $STORAGE  (root disk ${DISK_SIZE}G)
  Resources:   ${CORES} cores / ${MEMORY} MiB RAM
  Network:     dhcp on $BRIDGE
  Videos:      $VIDEOS_HOST_PATH (read-only -> /videos)
  App port:    $APP_PORT
  Git:         $GIT_URL  ($GIT_BRANCH)
--------------------------------------------------------
EOF

if [ -t 0 ]; then
  read -rp "Proceed? [Y/n] " yn
  case "${yn:-y}" in
    [Yy]*|'') ;;
    *) die "aborted" ;;
  esac
fi

# ---------- create LXC ----------
if pct status "$VMID" >/dev/null 2>&1; then
  die "VMID $VMID is already in use; pass VMID=<n> to override"
fi

say "creating LXC $VMID..."
pct create "$VMID" "$TEMPLATE_REF" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" \
  --memory "$MEMORY" \
  --swap 512 \
  --rootfs "${STORAGE}:${DISK_SIZE}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp,firewall=1" \
  --features nesting=1,keyctl=1 \
  --unprivileged 1 \
  --onboot 1 \
  --start 0 \
  --tags "mimi,dance,docker" \
  --description "Mimi's Dance Wonderland - https://github.com/tnargwoxow/homelab-apps"

# Bind-mount the videos path read-only at /videos inside the LXC.
# mp0 needs a path on the host filesystem (not on a Proxmox storage).
pct set "$VMID" -mp0 "${VIDEOS_HOST_PATH},mp=/videos,ro=1,backup=0"
ok "container created"

say "starting container..."
pct start "$VMID"

# Wait for network
say "waiting for network..."
IP=""
for _ in $(seq 1 30); do
  IP=$(pct exec "$VMID" -- ip -4 -o addr show dev eth0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1 || true)
  [ -n "$IP" ] && [ "$IP" != "" ] && break
  sleep 2
done
[ -n "$IP" ] || warn "couldn't detect IP via dhcp; container is up but network may not be ready"
ok "container IP: ${IP:-unknown}"

# ---------- bootstrap inside ----------
say "installing Docker + cloning repo + starting app inside the LXC..."

# Build the inside-script as a heredoc that runs via pct exec.
# We use bash -s so we can pass env via the parent's environment.
pct exec "$VMID" -- env \
  GIT_URL="$GIT_URL" \
  GIT_BRANCH="$GIT_BRANCH" \
  APP_PORT="$APP_PORT" \
  DEBIAN_FRONTEND=noninteractive \
  bash -s <<'INSIDE'
set -euo pipefail

log() { printf '  \033[1;36m·\033[0m %s\n' "$*"; }

log "apt update + base packages"
apt-get update -qq
apt-get install -y -qq curl ca-certificates git tzdata >/dev/null

log "installing Docker engine + compose plugin"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
systemctl enable --now docker >/dev/null

log "cloning ${GIT_URL} (${GIT_BRANCH})"
mkdir -p /opt
if [ ! -d /opt/homelab-apps ]; then
  git clone --depth 1 --branch "$GIT_BRANCH" "$GIT_URL" /opt/homelab-apps
else
  git -C /opt/homelab-apps fetch --depth 1 origin "$GIT_BRANCH"
  git -C /opt/homelab-apps checkout "$GIT_BRANCH"
  git -C /opt/homelab-apps reset --hard "origin/$GIT_BRANCH"
fi

cd /opt/homelab-apps/apps/dance-classes
# /videos is bind-mounted by the host already; tell compose to use that path.
cat > .env <<EOF
VIDEOS_HOST_PATH=/videos
EOF

# Override compose so the host bind path inside the LXC (/videos) is what
# gets mounted into the docker container. Avoids needing the user's
# original Proxmox-host path inside the LXC namespace.
cat > docker-compose.override.yml <<'YAML'
services:
  dance-classes:
    volumes:
      - /videos:/videos:ro
      - ./data:/data
YAML

log "building and starting (this will take a few minutes the first time)..."
docker compose pull --ignore-buildable 2>/dev/null || true
docker compose up -d --build

log "waiting for health..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${APP_PORT:-8080}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fsS "http://127.0.0.1:${APP_PORT:-8080}/healthz" >/dev/null 2>&1; then
  echo "WARNING: healthz not responding yet; check 'docker compose logs -f' inside the container."
fi

echo "INSIDE_DONE"
INSIDE

ok "bootstrap finished"

cat <<EOF

========================================================
  Mimi's Dance Wonderland is up!
========================================================
  Open:        http://${IP:-<container-ip>}:${APP_PORT}
  LXC VMID:    $VMID  (hostname: $HOSTNAME)
  Videos:      $VIDEOS_HOST_PATH  -> /videos (read-only)

  Useful commands on the PVE host:
    pct enter $VMID                # shell into the container
    pct stop  $VMID                # stop the container
    pct start $VMID                # start the container

  Useful commands inside the container:
    cd /opt/homelab-apps/apps/dance-classes
    docker compose logs -f         # tail logs
    docker compose restart         # restart the app
    docker compose pull && docker compose up -d --build   # update
========================================================
EOF
