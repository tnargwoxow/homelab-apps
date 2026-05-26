#!/usr/bin/env bash
set -euo pipefail

# Wedding Wordle — installer for a Google Compute Engine VM (Debian/Ubuntu).
#
# Run this ON the VM (e.g. after `gcloud compute ssh <vm>`). It installs Docker,
# clones this private repo, and brings the app up with docker compose. Scores
# live in a Docker named volume, so they survive restarts and redeploys.
#
# For the GCP always-free tier, create the VM as an e2-micro in us-west1,
# us-central1, or us-east1. See the commands printed at the end / the README.
#
# Required env:
#   GITHUB_TOKEN   PAT with read access to the private repo.
# Optional env:
#   REPO_BRANCH    Branch to deploy (default: claude/wedding-wordle-multiplayer-cSIqM).
#   ADMIN_TOKEN    Secret enabling POST /api/admin/reset (default: random).
#   PORT           Public host port to listen on (default: 80).
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx ADMIN_TOKEN=mysecret bash install-gce.sh

REPO_OWNER="tnargwoxow"
REPO_NAME="homelab-apps"
REPO_BRANCH="${REPO_BRANCH:-claude/wedding-wordle-multiplayer-cSIqM}"
INSTALL_DIR="/opt/${REPO_NAME}"
APP_DIR="${INSTALL_DIR}/apps/wedding-wordle"
PORT="${PORT:-80}"
ADMIN_TOKEN="${ADMIN_TOKEN:-$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN must be set (read access to the private repo)." >&2
  exit 1
fi

echo ">> Installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git gnupg

echo ">> Ensuring 1G swap (e2-micro has only ~1GB RAM)..."
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo ">> Installing Docker CE..."
if ! command -v docker >/dev/null 2>&1; then
  . /etc/os-release
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo systemctl enable --now docker

echo ">> Fetching ${REPO_OWNER}/${REPO_NAME} (${REPO_BRANCH})..."
AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  sudo git -C "${INSTALL_DIR}" remote set-url origin "${AUTH_URL}"
  sudo git -C "${INSTALL_DIR}" fetch --depth 1 origin "${REPO_BRANCH}"
  sudo git -C "${INSTALL_DIR}" checkout -B "${REPO_BRANCH}" "origin/${REPO_BRANCH}"
  sudo git -C "${INSTALL_DIR}" reset --hard "origin/${REPO_BRANCH}"
else
  sudo git clone --depth 1 --branch "${REPO_BRANCH}" "${AUTH_URL}" "${INSTALL_DIR}"
fi
# Don't leave the token sitting in the stored remote URL.
sudo git -C "${INSTALL_DIR}" remote set-url origin \
  "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo ">> Writing deploy config..."
# docker compose auto-reads this .env for ${PORT} / ${ADMIN_TOKEN} substitution.
sudo tee "${APP_DIR}/.env" >/dev/null <<EOF
PORT=${PORT}
ADMIN_TOKEN=${ADMIN_TOKEN}
EOF

echo ">> Building and starting the app..."
cd "${APP_DIR}"
sudo docker compose up -d --build

IP="$(curl -fsS -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || true)"

echo
echo "============================================================"
echo " Wedding Wordle is up."
echo "   Local:   http://localhost:${PORT}"
[[ -n "${IP}" ]] && echo "   Public:  http://${IP}:${PORT}"
echo "   ADMIN_TOKEN: ${ADMIN_TOKEN}"
echo "============================================================"
echo "If you can't reach the public URL, open the VPC firewall for tcp:${PORT}:"
echo "  gcloud compute firewall-rules create allow-wordle \\"
echo "    --allow tcp:${PORT} --source-ranges 0.0.0.0/0 --target-tags wordle"
echo "  gcloud compute instances add-tags <VM_NAME> --zone <ZONE> --tags wordle"
echo
echo "Update later:  cd ${APP_DIR} && sudo git pull && sudo docker compose up -d --build"
