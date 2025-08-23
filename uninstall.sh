#!/usr/bin/env bash

set -euo pipefail

# FinX Uninstaller for Debian/Ubuntu
# Removes the FinX service, configs, database/user, nginx/apache vhosts, env, and app code.
# Defaults: drop DB and delete app user/code. Use flags to keep specific items.
# Flags:
#   --keep-db      Do not drop the PostgreSQL database and role
#   --keep-user    Do not delete the FinX system user/home
#   --keep-env     Do not delete /etc/finx
#   --keep-code    Do not delete the application directory
#   --purge        Force removal even if safety checks are uncertain

APP_NAME="finx"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/${APP_NAME}.env"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}.conf"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}.conf"
APACHE_SITE="/etc/apache2/sites-available/${APP_NAME}.conf"

KEEP_DB=false
KEEP_USER=false
KEEP_ENV=false
KEEP_CODE=false
PURGE=false

BLUE="\033[1;34m"; GREEN="\033[1;32m"; YELLOW="\033[1;33m"; RED="\033[1;31m"; NC="\033[0m"
say() { echo -e "${BLUE}⇒${NC} $*"; }
ok()  { echo -e "${GREEN}✔${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✖${NC} $*"; }

need_sudo() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
      SUDO="sudo"
    else
      err "This script requires root privileges or sudo installed."
      exit 1
    fi
  else
    SUDO=""
  fi
}

run_as_postgres() {
  if [ -n "${SUDO}" ]; then
    ${SUDO} -u postgres "$@"
  else
    su -s /bin/sh -c "$(printf '%q ' "$@")" postgres
  fi
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --keep-db)   KEEP_DB=true ;;
      --keep-user) KEEP_USER=true ;;
      --keep-env)  KEEP_ENV=true ;;
      --keep-code) KEEP_CODE=true ;;
      --purge)     PURGE=true ;;
      *) warn "Unknown option: $1" ;;
    esac
    shift || true
  done
}

detect_install() {
  APP_DIR=""
  RUN_USER=""
  if [ -f "${SERVICE_FILE}" ]; then
    say "Reading service file: ${SERVICE_FILE}"
    APP_DIR=$(awk -F= '/^WorkingDirectory=/ {print $2}' "${SERVICE_FILE}" || true)
    RUN_USER=$(awk -F= '/^User=/ {print $2}' "${SERVICE_FILE}" || true)
  fi
  [ -z "${APP_DIR}" ] && APP_DIR="/opt/${APP_NAME}"
  [ -z "${RUN_USER}" ] && RUN_USER="${APP_NAME}"
  ok "Detected APP_DIR=${APP_DIR}, RUN_USER=${RUN_USER}"
}

stop_disable_service() {
  if systemctl is-active --quiet "${APP_NAME}.service"; then
    say "Stopping service ${APP_NAME}.service"
    $SUDO systemctl stop "${APP_NAME}.service" || true
  fi
  if systemctl is-enabled --quiet "${APP_NAME}.service"; then
    say "Disabling service ${APP_NAME}.service"
    $SUDO systemctl disable "${APP_NAME}.service" || true
  fi
  if [ -f "${SERVICE_FILE}" ]; then
    say "Removing ${SERVICE_FILE}"
    $SUDO rm -f "${SERVICE_FILE}"
    $SUDO systemctl daemon-reload || true
  fi
  ok "Service removed"
}

remove_nginx_site() {
  if ! dpkg -s nginx >/dev/null 2>&1; then return 0; fi
  say "Removing Nginx site"
  [ -L "${NGINX_SITE_ENABLED}" ] && $SUDO rm -f "${NGINX_SITE_ENABLED}" || true
  [ -f "${NGINX_SITE_AVAILABLE}" ] && $SUDO rm -f "${NGINX_SITE_AVAILABLE}" || true
  $SUDO nginx -t && $SUDO systemctl reload nginx || true
  ok "Nginx site removed"
}

remove_apache_site() {
  if ! dpkg -s apache2 >/dev/null 2>&1; then return 0; fi
  say "Removing Apache site"
  # Capture port from existing site to optionally remove Listen from ports.conf
  SITE_PORT=""
  if [ -f "${APACHE_SITE}" ]; then
    SITE_PORT=$(awk -F: '/<VirtualHost \*:/{gsub(/>/,""); print $2; exit}' "${APACHE_SITE}" || true)
  fi
  $SUDO a2dissite "${APP_NAME}.conf" >/dev/null 2>&1 || true
  [ -f "${APACHE_SITE}" ] && $SUDO rm -f "${APACHE_SITE}" || true
  if [ -n "${SITE_PORT}" ] && [ -f /etc/apache2/ports.conf ]; then
    # Never remove default ports
    if [ "${SITE_PORT}" != "80" ] && [ "${SITE_PORT}" != "443" ]; then
      if grep -qE "^Listen[[:space:]]+${SITE_PORT}(\b|[[:space:]]|$)" /etc/apache2/ports.conf; then
        say "Removing Apache Listen ${SITE_PORT}"
        $SUDO sed -i "/^Listen[[:space:]]\+${SITE_PORT}[[:space:]]*$/d" /etc/apache2/ports.conf || true
      fi
    else
      warn "Skipping removal of default Apache Listen ${SITE_PORT}"
    fi
  fi
  $SUDO apache2ctl configtest && $SUDO systemctl reload apache2 || true
  ok "Apache site removed"
}

drop_database_and_role() {
  ${KEEP_DB} && { warn "Keeping database and role (per flag)"; return 0; }
  # Source env for DB_NAME/DB_USER
  if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
  fi
  if [ -z "${DB_NAME:-}" ] && [ -f "${APP_DIR}/.env" ]; then
    # fallback to app local env
    # shellcheck disable=SC1090
    source "${APP_DIR}/.env" || true
  fi
  if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
    warn "DB_NAME or DB_USER not found; skipping DB cleanup"
    return 0
  fi
  say "Dropping PostgreSQL database ${DB_NAME} and role ${DB_USER}"
  # Terminate connections on the target DB; use plain SQL so psql expands :'DBNAME'
  run_as_postgres psql -v ON_ERROR_STOP=1 -d postgres -v DBNAME="${DB_NAME}" <<'SQL' || true
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = :'DBNAME'
    AND pid <> pg_backend_pid();
SQL
  run_as_postgres psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" || true
  run_as_postgres psql -v ON_ERROR_STOP=1 -d postgres -c "DROP ROLE IF EXISTS \"${DB_USER}\";" || true
  ok "Database and role removed"
}

remove_env_dir() {
  ${KEEP_ENV} && { warn "Keeping env dir (per flag)"; return 0; }
  if [ -d "${ENV_DIR}" ]; then
    say "Removing ${ENV_DIR}"
    $SUDO rm -rf "${ENV_DIR}"
    ok "Env removed"
  fi
}

safe_rm_app_dir() {
  ${KEEP_CODE} && { warn "Keeping app code (per flag)"; return 0; }
  if [ -z "${APP_DIR}" ] || [ "${APP_DIR}" = "/" ]; then
    err "Refusing to remove APP_DIR: '${APP_DIR}'"
    return 0
  fi
  if [[ "${APP_DIR}" != *"/${APP_NAME}"* && "${APP_DIR}" != "/opt/${APP_NAME}"* ]] && [ "${PURGE}" != true ]; then
    warn "APP_DIR '${APP_DIR}' does not look like a FinX directory; skip (use --purge to force)"
    return 0
  fi
  say "Removing application directory ${APP_DIR}"
  $SUDO rm -rf "${APP_DIR}"
  ok "Application directory removed"
}

remove_app_user() {
  ${KEEP_USER} && { warn "Keeping app user (per flag)"; return 0; }
  if [ -z "${RUN_USER}" ]; then return 0; fi
  if id -u "${RUN_USER}" >/dev/null 2>&1; then
    # Only remove if looks like a FinX system user
    local shell home
    shell=$(getent passwd "${RUN_USER}" | awk -F: '{print $7}')
    home=$(getent passwd "${RUN_USER}" | awk -F: '{print $6}')
    if { [ "${RUN_USER}" = "${APP_NAME}" ] || [[ "${home}" == "/home/${APP_NAME}"* ]]; } && [[ "${shell}" == */nologin* || "${shell}" == */false* ]]; then
      say "Deleting user ${RUN_USER} and home ${home}"
      $SUDO userdel -r "${RUN_USER}" >/dev/null 2>&1 || $SUDO userdel "${RUN_USER}" || true
      ok "User ${RUN_USER} removed"
    else
      warn "User ${RUN_USER} does not look like a dedicated FinX system user; skipping"
    fi
  fi
}

finalize() {
  ok "FinX uninstallation complete"
}

main() {
  parse_args "$@"
  need_sudo
  detect_install
  stop_disable_service
  remove_nginx_site
  remove_apache_site
  drop_database_and_role
  remove_env_dir
  safe_rm_app_dir
  remove_app_user
  finalize
}

main "$@"
