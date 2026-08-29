#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban

ssh_config="$(mktemp)"
fail2ban_config="$(mktemp)"
cleanup() {
  rm -f "$ssh_config" "$fail2ban_config"
}
trap cleanup EXIT

printf '%s\n' \
  '# OdontoCloud host SSH hardening' \
  'PasswordAuthentication no' \
  'KbdInteractiveAuthentication no' \
  'PubkeyAuthentication yes' \
  'MaxAuthTries 3' \
  'LoginGraceTime 30' \
  > "$ssh_config"

printf '%s\n' \
  '[sshd]' \
  'enabled = true' \
  'backend = systemd' \
  'port = ssh' \
  'maxretry = 5' \
  'findtime = 10m' \
  'bantime = 1h' \
  'bantime.increment = true' \
  'bantime.factor = 2' \
  'bantime.maxtime = 24h' \
  > "$fail2ban_config"

sudo install -o root -g root -m 0644 \
  "$ssh_config" /etc/ssh/sshd_config.d/99-odontocloud-hardening.conf
sudo install -o root -g root -m 0644 \
  "$fail2ban_config" /etc/fail2ban/jail.d/odontocloud-sshd.local

sudo sshd -t
sudo systemctl reload ssh
sudo systemctl enable --now fail2ban
sudo fail2ban-client reload

echo 'SSH and fail2ban hardening applied.'
