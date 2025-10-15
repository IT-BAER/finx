#!/usr/bin/env bash

set -euo pipefail
set -E  # enable ERR trap inheritance

# Preserve original script arguments for potential re-exec under elevated user
SCRIPT_ARGS=("$@")

# Non-interactive apt and sane locale defaults (quiet Perl/apt warnings on minimal systems)
export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export LANGUAGE=C

# FinX Debian/Ubuntu Installer (interactive + idempotent)
# - Installs Node.js LTS, PostgreSQL, Nginx (optional)
# - Creates database and app user with strong passwords
# - Generates .env, builds frontend
# - Configures systemd service and Nginx site
# - Starts everything and prints next steps

APP_NAME="finx"
APP_USER_DEFAULT="finx"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR_DEFAULT="/opt/${APP_NAME}"
REPO_URL_DEFAULT="https://github.com/IT-BAER/finx.git"
# Optional versioning controls (can be provided via environment)
# FINX_REF: branch, tag, or commit to install (e.g., v1.2.3)
# FINX_ARCHIVE_URL: URL to a release archive (.tar.gz/.tgz/.zip) to install
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/${APP_NAME}.env"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}.conf"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}.conf"
FRONTEND_PORT=""
UPDATE_MODE="n"

# Creation flags for rollback
CREATED_SYSTEM_USER="n"
CREATED_INSTALL_DIR="n"
CREATED_ENV_FILE="n"
CREATED_SERVICE="n"
CREATED_NGINX_SITE="n"
CREATED_APACHE_SITE="n"
APPENDED_APACHE_PORT="n"
CREATED_DB_USER="n"
CREATED_DB="n"
STARTED_SERVICE="n"
COMPLETED="n"

APACHE_SITE_FILE="/etc/apache2/sites-available/${APP_NAME}.conf"
APACHE_PORTS_CONF="/etc/apache2/ports.conf"

BLUE="\033[1;34m"; GREEN="\033[1;32m"; YELLOW="\033[1;33m"; RED="\033[1;31m"; NC="\033[0m"
say() { echo -e "${BLUE}⇒${NC} $*"; }
ok()  { echo -e "${GREEN}✔${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✖${NC} $*"; }

need_sudo() {
    if [ "${EUID:-$(id -u)}" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        elif command -v doas >/dev/null 2>&1; then
            # Support OpenBSD-style privilege escalation
            SUDO="doas"
        else
            warn "Neither sudo nor doas is installed. Attempting to re-run as root using su."
            # Resolve absolute path to this script
            local SELF
            if command -v realpath >/dev/null 2>&1; then
                SELF=$(realpath "$0")
            elif command -v readlink >/dev/null 2>&1; then
                SELF=$(readlink -f "$0" 2>/dev/null || echo "$0")
            else
                SELF="$0"
            fi
            # Re-exec using su, preserving arguments; will prompt for root password
            su -s /bin/sh -c "exec /usr/bin/env bash \"$SELF\" ${SCRIPT_ARGS[*]@Q}" root
            # If su returns, it failed
            err "Privilege escalation failed. Please run as root or install sudo/doas."
            exit 1
        fi
    else
        SUDO=""
    fi
}

setup_traps() {
    # Install traps after sudo detection so cleanup can use $SUDO
    trap 'on_error' ERR
    trap 'on_interrupt' INT TERM
}

on_error() {
    err "Setup failed. Rolling back partial changes..."
    cleanup "error"
    exit 1
}

on_interrupt() {
    warn "Setup interrupted. Rolling back partial changes..."
    cleanup "interrupt"
    exit 130
}

cleanup() {
    local reason="${1:-unknown}"
    # Stop service if we started it
    if [ "$STARTED_SERVICE" = "y" ] && [ -f "$SERVICE_FILE" ]; then
        $SUDO systemctl stop "${APP_NAME}.service" || true
    fi
    # Disable and remove systemd service if we created it this run
    if [ "$CREATED_SERVICE" = "y" ] && [ -f "$SERVICE_FILE" ]; then
        $SUDO systemctl disable "${APP_NAME}.service" >/dev/null 2>&1 || true
        $SUDO rm -f "$SERVICE_FILE" || true
        $SUDO systemctl daemon-reload || true
    fi
    # Remove nginx site if we created it
    if [ "$CREATED_NGINX_SITE" = "y" ]; then
        [ -L "$NGINX_SITE_ENABLED" ] && $SUDO rm -f "$NGINX_SITE_ENABLED" || true
        [ -f "$NGINX_SITE_AVAILABLE" ] && $SUDO rm -f "$NGINX_SITE_AVAILABLE" || true
        command -v nginx >/dev/null 2>&1 && $SUDO nginx -t >/dev/null 2>&1 && $SUDO systemctl reload nginx || true
    fi
    # Remove apache site and revert port if we created/appended
    if [ "$CREATED_APACHE_SITE" = "y" ]; then
        [ -f "$APACHE_SITE_FILE" ] && $SUDO a2dissite "${APP_NAME}.conf" >/dev/null 2>&1 || true
        [ -f "$APACHE_SITE_FILE" ] && $SUDO rm -f "$APACHE_SITE_FILE" || true
        if [ "$APPENDED_APACHE_PORT" = "y" ] && [ -f "$APACHE_PORTS_CONF" ]; then
            $SUDO sed -i "/^Listen[[:space:]]\+${FRONTEND_PORT}$/d" "$APACHE_PORTS_CONF" || true
        fi
        command -v apache2ctl >/dev/null 2>&1 && $SUDO apache2ctl configtest >/dev/null 2>&1 && $SUDO systemctl reload apache2 || true
    fi
    # Remove env file if created
    if [ "$CREATED_ENV_FILE" = "y" ] && [ -f "$ENV_FILE" ]; then
        $SUDO rm -f "$ENV_FILE" || true
    fi
    # Drop database and role if we created them
    if [ "$CREATED_DB" = "y" ]; then
        run_as_user postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};" || true
    fi
    if [ "$CREATED_DB_USER" = "y" ]; then
        run_as_user postgres psql -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS ${DB_USER};" || true
    fi
    # Remove app directory if we created it
    if [ "$CREATED_INSTALL_DIR" = "y" ] && [ -n "${INSTALL_DIR_DEFAULT}" ] && [ -d "${FINX_INSTALL_DIR:-${INSTALL_DIR_DEFAULT}}" ]; then
        $SUDO rm -rf "${FINX_INSTALL_DIR:-${INSTALL_DIR_DEFAULT}}" || true
    fi
    # Remove system user if we created it
    if [ "$CREATED_SYSTEM_USER" = "y" ]; then
        $SUDO userdel -r "$APP_USER" >/dev/null 2>&1 || true
    fi
    warn "Rollback finished (${reason})."
}

# Run a command as a given system user, compatible with both sudo and pure-root contexts
run_as_user() {
    local _user="$1"; shift
    if [ -n "${SUDO}" ]; then
        # sudo and doas both support -u
        ${SUDO} -u "${_user}" "$@"
    else
        # Use su for root context; preserve environment variables passed explicitly
    su -s /bin/sh -c "cd / && $(printf '%q ' "$@")" "${_user}"
    fi
}

# Run a command as a given user within a specific directory (preserve cwd for that command)
run_as_user_in_dir() {
    local _user="$1"; shift
    local _dir="$1"; shift
    if [ -n "${SUDO}" ]; then
        ${SUDO} -u "${_user}" bash -lc "cd $(printf '%q' "${_dir}") && $(printf '%q ' "$@")"
    else
        su -s /bin/sh -c "cd $(printf '%q' "${_dir}") && $(printf '%q ' "$@")" "${_user}"
    fi
}

detect_os() {
    if [ -f /etc/debian_version ]; then
        ok "Debian/Ubuntu detected"
    else
        warn "This installer is intended for Debian/Ubuntu. Continuing anyway."
    fi
}

# Ensure the dedicated system user exists early if requested, so we can chown/clone as that user
ensure_system_user() {
    [ "${CREATE_USER}" = "y" ] || return 0
    if id -u "$APP_USER" >/dev/null 2>&1; then
        ok "User $APP_USER exists"
        return 0
    fi
    say "Creating system user $APP_USER"
    $SUDO useradd -r -m -d "/home/${APP_USER}" -s /usr/sbin/nologin "$APP_USER"
    CREATED_SYSTEM_USER="y"
}

generate_secret() {
    # 40 chars alnum
    # Suppress potential SIGPIPE stderr from tr when head closes early
    tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 40 || true
}

ensure_pkg() {
    local pkg="$1"
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        say "Installing package: $pkg"
    apt_update_once
    $SUDO apt-get install -y "$pkg"
    else
        ok "$pkg already installed"
    fi
}

ensure_tool() {
    # Ensure a generic tool exists (curl, unzip, tar are typically present)
    local tool="$1"
    if ! command -v "$tool" >/dev/null 2>&1; then
        case "$tool" in
            curl) ensure_pkg curl ;;
            unzip) ensure_pkg unzip ;;
            tar) ensure_pkg tar ;;
            git) ensure_pkg git ;;
            *) ensure_pkg "$tool" ;;
        esac
    fi
}

# Load existing settings for non-interactive updates
load_existing_settings() {
    say "Existing installation detected; running update with current settings"
    # Load env if present
    if [ -f "$ENV_FILE" ]; then
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        PORT=${PORT:-5000}
        DB_NAME=${DB_NAME:-finx_db}
        DB_USER=${DB_USER:-finx_user}
        export DB_PASSWORD=${DB_PASSWORD:-}
    fi
    # Determine service user
    if [ -f "$SERVICE_FILE" ]; then
        local SVC_USER
        SVC_USER=$(grep -E '^User=' "$SERVICE_FILE" | tail -n1 | cut -d'=' -f2 || true)
        if [ -n "$SVC_USER" ]; then
            CREATE_USER=y
            APP_USER="$SVC_USER"
        fi
    fi
    # Detect existing web server in use
    if [ -f "/etc/nginx/sites-available/${APP_NAME}.conf" ]; then
        WEB_SERVER=nginx
    elif [ -f "/etc/apache2/sites-available/${APP_NAME}.conf" ]; then
        WEB_SERVER=apache
    else
        WEB_SERVER=none
    fi
}

install_node() {
    if command -v node >/dev/null 2>&1; then
        local v;
        v=$(node -v | sed 's/v//')
        say "Found Node.js ${v}"
    else
        say "Installing Node.js LTS (20.x) via NodeSource"
        if [ -n "${SUDO}" ]; then
            if [ "${SUDO}" = "sudo" ]; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            else
                # doas (no -E support); pipe directly
                curl -fsSL https://deb.nodesource.com/setup_20.x | ${SUDO} bash -
            fi
        else
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        fi
        ensure_pkg nodejs
    fi
}

install_postgres() {
    if ! command -v psql >/dev/null 2>&1; then
        say "Installing PostgreSQL"
        ensure_pkg postgresql
        ensure_pkg postgresql-contrib
    else
        ok "PostgreSQL already installed"
    fi
    $SUDO systemctl enable postgresql
    $SUDO systemctl start postgresql
}

# Run apt-get update once per session to speed up repeated installs
APT_UPDATED_FLAG="/tmp/.finx-apt-updated.flag"
apt_update_once() {
    if [ ! -f "$APT_UPDATED_FLAG" ]; then
        $SUDO apt-get update -y
        touch "$APT_UPDATED_FLAG"
    fi
}

is_pkg_installed() { dpkg -s "$1" >/dev/null 2>&1; }

install_web_server() {
    case "${WEB_SERVER}" in
        nginx)
            ensure_pkg nginx
            $SUDO systemctl enable nginx
            $SUDO systemctl start nginx
            ;;
        apache)
            ensure_pkg apache2
            # Enable required Apache modules (include proxy_wstunnel for WebSockets)
            $SUDO a2enmod proxy proxy_http proxy_wstunnel headers rewrite deflate mime expires >/dev/null 2>&1 || true
            $SUDO systemctl enable apache2
            $SUDO systemctl start apache2
            ;;
        none|"")
            warn "Skipping web server installation"
            ;;
    esac
}

# Determine a free frontend port starting at 3000, avoiding conflicts in nginx/apache configs and active listeners
port_in_use_any() {
    local p="$1"
    # Check active listeners
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | awk '{print $4}' | grep -E "(^|:)${p}$" -q && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | awk '{print $4}' | grep -E "(^|:)${p}$" -q && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i TCP:${p} -sTCP:LISTEN >/dev/null 2>&1 && return 0
    fi
    # Check nginx configs
    if [ -d /etc/nginx ]; then
        grep -RhoE "\\blisten\\s+${p}(;|\\s)" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null | grep -q . && return 0
    fi
    # Check apache configs
    if [ -d /etc/apache2 ]; then
        grep -RhoE "(VirtualHost|Listen)\\s+\*?:${p}\\b" /etc/apache2 2>/dev/null | grep -q . && return 0
    fi
    return 1
}

choose_frontend_port() {
    local start=${1:-3000}
    local max=$((start+200))
    local p=${start}
    while [ ${p} -le ${max} ]; do
        if ! port_in_use_any "${p}"; then
            FRONTEND_PORT="${p}"
            ok "Selected frontend port ${FRONTEND_PORT}"
            return 0
        fi
        p=$((p+1))
    done
    # Fallback
    FRONTEND_PORT="${start}"
    warn "Could not find a free port between ${start}-${max}; using ${FRONTEND_PORT}"
}

ensure_repo() {
    # When executed inside a checked-out tree, use it as-is
    if [ -f "${APP_DIR}/package.json" ] && [ -f "${APP_DIR}/server.js" ]; then
        ok "Repository detected at ${APP_DIR}"
        return 0
    fi

    local INSTALL_DIR REPO_URL ARCHIVE_URL REF TMP
    INSTALL_DIR="${FINX_INSTALL_DIR:-${INSTALL_DIR_DEFAULT}}"
    REPO_URL="${FINX_REPO_URL:-${REPO_URL_DEFAULT}}"
    ARCHIVE_URL="${FINX_ARCHIVE_URL:-}"
    REF="${FINX_REF:-}"

    if [ ! -d "${INSTALL_DIR}" ]; then
        $SUDO mkdir -p "${INSTALL_DIR}"
        CREATED_INSTALL_DIR="y"
    fi
    if [ "${CREATE_USER}" = "y" ]; then
        $SUDO chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
    fi

    # Path A: Install from a release/archive if provided
    if [ -n "${ARCHIVE_URL}" ]; then
        say "Fetching release archive to ${INSTALL_DIR}"
        ensure_tool curl
        ensure_tool file
        # Determine filename
        TMP=$(mktemp -t finx-archive-XXXX)
        # Download as the target user if created, else as current user
        if [ "${CREATE_USER}" = "y" ]; then
            run_as_user "${APP_USER}" curl -fsSL "${ARCHIVE_URL}" -o "${TMP}"
        else
            curl -fsSL "${ARCHIVE_URL}" -o "${TMP}"
        fi
        # Detect archive type and extract
        if file -b "${TMP}" | grep -qi 'gzip\|tar'; then
            ensure_tool tar
            if [ "${CREATE_USER}" = "y" ]; then
                run_as_user "${APP_USER}" tar -xzf "${TMP}" -C "${INSTALL_DIR}"
            else
                tar -xzf "${TMP}" -C "${INSTALL_DIR}"
            fi
        else
            ensure_tool unzip
            if [ "${CREATE_USER}" = "y" ]; then
                run_as_user "${APP_USER}" unzip -q "${TMP}" -d "${INSTALL_DIR}"
            else
                unzip -q "${TMP}" -d "${INSTALL_DIR}"
            fi
        fi
        rm -f "${TMP}"
        # If the archive extracted into a single top-level directory, flatten it
        local entries count first
        entries=$(ls -1A "${INSTALL_DIR}" | wc -l | tr -d ' ')
    if [ "${entries}" = "1" ]; then
            first=$(ls -1A "${INSTALL_DIR}")
            if [ -d "${INSTALL_DIR}/${first}" ]; then
                say "Flattening extracted directory ${first}"
        # Use bash for dotglob to include hidden files when moving
        $SUDO bash -lc "shopt -s dotglob; mv '${INSTALL_DIR}/${first}'/* '${INSTALL_DIR}/'"
                $SUDO rm -rf "${INSTALL_DIR}/${first}"
            fi
        fi
        APP_DIR="${INSTALL_DIR}"
        ok "Using APP_DIR=${APP_DIR} (from archive)"
        return 0
    fi

    # Path B: Git clone (prefer actual releases only, not arbitrary tags)
    # If no explicit REF/ARCHIVE_URL provided, try to detect a real release via provider API; else fallback to main branch
    if [ -z "${REF}" ] && [ -z "${ARCHIVE_URL}" ]; then
        ensure_tool curl
        # Parse REPO_URL to host/owner/name
        local _url _host _path _owner _name _api_release_url _api_type
        _url="${REPO_URL%.git}"
        # Normalize ssh form git@host:owner/name to https://host/owner/name
        if echo "${_url}" | grep -qE '^[^/]+@[^:]+:'; then
            _host=$(printf "%s" "${_url}" | sed -E 's/^[^@]+@([^:]+):.*/\1/')
            _path=$(printf "%s" "${_url}" | sed -E 's/^[^:]+:(.*)/\1/')
        else
            _host=$(printf "%s" "${_url}" | sed -E 's#^https?://([^/]+)/.*#\1#')
            _path=$(printf "%s" "${_url}" | sed -E 's#^https?://[^/]+/(.*)$#\1#')
        fi
        _owner=$(printf "%s" "${_path}" | awk -F'/' '{print $1}')
        _name=$(printf "%s" "${_path}" | awk -F'/' '{print $2}')
        local NO_RELEASE="y"
        if [ -n "${_host}" ] && [ -n "${_owner}" ] && [ -n "${_name}" ]; then
            # Try GitHub
            if [ "${_host}" = "github.com" ]; then
                _api_release_url="https://api.github.com/repos/${_owner}/${_name}/releases/latest"
                say "Checking GitHub releases for ${_owner}/${_name}"
                local api
                api=$(curl -fsSL "${_api_release_url}" 2>/dev/null || true)
                if echo "$api" | grep -q '"tag_name"'; then
                    local tag tarball
                    tag=$(printf "%s" "$api" | sed -n 's/.*"tag_name"\s*:\s*"\([^"]\+\)".*/\1/p' | head -n1)
                    tarball=$(printf "%s" "$api" | sed -n 's/.*"tarball_url"\s*:\s*"\([^"]\+\)".*/\1/p' | head -n1)
                    if [ -n "$tag" ] && [ -n "$tarball" ]; then
                        REF="$tag"; ARCHIVE_URL="$tarball"; NO_RELEASE="n";
                        ok "Found latest GitHub release: ${REF}"
                    fi
                fi
            else
                # Try Gitea API (common for self-hosted at ${_host})
                _api_release_url="https://${_host}/api/v1/repos/${_owner}/${_name}/releases"
                say "Checking releases via ${_host} API"
                local api
                api=$(curl -fsSL "${_api_release_url}" 2>/dev/null || true)
                if echo "$api" | grep -q '\[{'; then
                    # Pick first release that's not draft/prerelease if possible
                    # Crude parse without jq: find first block with "draft":false and "prerelease":false
                    local block
                    block=$(printf "%s" "$api" | tr '\n' ' ' | sed 's/\],/\]\n/g' | sed -n '1,1p')
                    # Extract tag_name and (zip|tar)ball
                    local tag tarball zipball
                    tag=$(printf "%s" "$api" | sed -n 's/.*"draft"\s*:\s*false[^\}]*"prerelease"\s*:\s*false[^\}]*"tag_name"\s*:\s*"\([^"]\+\)".*/\1/p' | head -n1)
                    tarball=$(printf "%s" "$api" | sed -n 's/.*"tarball_url"\s*:\s*"\([^"]\+\)".*/\1/p' | head -n1)
                    zipball=$(printf "%s" "$api" | sed -n 's/.*"zipball_url"\s*:\s*"\([^"]\+\)".*/\1/p' | head -n1)
                    if [ -n "$tag" ]; then
                        REF="$tag"; ARCHIVE_URL="${tarball:-$zipball}"; NO_RELEASE="n";
                        ok "Found latest release: ${REF}"
                    fi
                fi
            fi
        fi
        if [ "${NO_RELEASE}" = "y" ]; then
            warn "No actual releases found; will clone from 'main' branch"
        fi
    fi


    # If release detection found an archive URL, use it instead of git clone
    if [ -n "${ARCHIVE_URL}" ]; then
        say "Using release archive: ${ARCHIVE_URL}"
        ensure_tool curl
        ensure_tool file
        # For updates, remove existing git repo to avoid conflicts
        if [ -d "${INSTALL_DIR}/.git" ]; then
            say "Removing existing git repository for archive-based update"
            $SUDO rm -rf "${INSTALL_DIR}/.git"
        fi
        TMP=$(mktemp -t finx-archive-XXXX)
        curl -fsSL "${ARCHIVE_URL}" -o "${TMP}"
        if file -b "${TMP}" | grep -qi 'gzip\|tar'; then
            ensure_tool tar
            tar -xzf "${TMP}" -C "${INSTALL_DIR}" --strip-components=1
        else
            ensure_tool unzip
            unzip -q "${TMP}" -d "${INSTALL_DIR}"
            # Flatten if needed
            local entries first
            entries=$(ls -1A "${INSTALL_DIR}" | wc -l | tr -d ' ')
            if [ "${entries}" = "1" ]; then
                first=$(ls -1A "${INSTALL_DIR}")
                if [ -d "${INSTALL_DIR}/${first}" ]; then
                    say "Flattening extracted directory ${first}"
                    $SUDO bash -lc "shopt -s dotglob; mv '${INSTALL_DIR}/${first}'/* '${INSTALL_DIR}/'"
                    $SUDO rm -rf "${INSTALL_DIR}/${first}"
                fi
            fi
        fi
        rm -f "${TMP}"
        APP_DIR="${INSTALL_DIR}"
        ok "Using APP_DIR=${APP_DIR} (from release archive ${REF})"
        return 0
    fi
    ensure_tool git
    say "Preparing FinX repo in ${INSTALL_DIR}${REF:+ (ref: ${REF})}"
    if [ -d "${INSTALL_DIR}/.git" ]; then
        ok "Existing git repo found at ${INSTALL_DIR}"
        APP_DIR="${INSTALL_DIR}"
        # Update flow (no tag heuristics):
        # - If a release REF was detected earlier, checkout that ref; else hard reset to origin/main
        # Run all git commands as the app user to avoid 'dubious ownership'
        if [ -n "${REF}" ] && [ -z "${ARCHIVE_URL}" ]; then
            say "Updating repository to release ref: ${REF}"
            if [ "${CREATE_USER}" = "y" ]; then
                run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git fetch --all --prune || warn "git fetch failed in ${INSTALL_DIR}"
                run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git checkout -q "${REF}" || warn "Checkout of ${REF} failed; repository remains unchanged"
            else
                (
                    cd "${INSTALL_DIR}" && \
                    git fetch --all --prune && \
                    git checkout -q "${REF}"
                ) || warn "Checkout of ${REF} failed; repository remains unchanged"
            fi
        else
            say "Updating repository to main branch"
            if [ "${CREATE_USER}" = "y" ]; then
                # Try fetching specific branch first, fallback to generic fetch
                run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git fetch origin main || run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git fetch origin || true
                run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git checkout -q main || true
                run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git reset --hard origin/main || true
            else
                (
                    cd "${INSTALL_DIR}" && \
                    git fetch origin main || git fetch origin && \
                    git checkout -q main || true && \
                    git reset --hard origin/main || true
                ) || warn "Update to main branch encountered issues; repository may be unchanged"
            fi
        fi
        return 0
    fi

    if [ -n "${REF}" ] && [ -z "${ARCHIVE_URL}" ]; then
        # Clone and checkout specific ref (branch or commit)
        if [ "${CREATE_USER}" = "y" ]; then
            run_as_user "${APP_USER}" git clone "${REPO_URL}" "${INSTALL_DIR}"
            run_as_user_in_dir "${APP_USER}" "${INSTALL_DIR}" git checkout "${REF}"
        else
            git clone "${REPO_URL}" "${INSTALL_DIR}"
            ( cd "${INSTALL_DIR}" && git checkout "${REF}" )
        fi
    else
        # Prefer cloning 'main'; if it fails, fall back to provider default branch
        if [ "${CREATE_USER}" = "y" ]; then
            if ! run_as_user "${APP_USER}" git clone --depth 1 -b main "${REPO_URL}" "${INSTALL_DIR}" 2>/dev/null; then
                warn "Branch 'main' not found; cloning default branch"
                run_as_user "${APP_USER}" git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
            fi
        else
            if ! git clone --depth 1 -b main "${REPO_URL}" "${INSTALL_DIR}" 2>/dev/null; then
                warn "Branch 'main' not found; cloning default branch"
                git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
            fi
        fi
    fi
    APP_DIR="${INSTALL_DIR}"
    ok "Using APP_DIR=${APP_DIR}"
}

prompt_inputs() {
    say "Welcome to FinX installer"
    read -rp "Domain to serve frontend (blank for localhost): " DOMAIN || true
    read -rp "Backend port [5000]: " PORT || true; PORT=${PORT:-5000}
    read -rp "Create a dedicated system user to run FinX? [Y/n]: " CREATE_USER || true
    CREATE_USER=$(echo "${CREATE_USER:-Y}" | tr '[:upper:]' '[:lower:]')
    if [ "${CREATE_USER}" = "y" ]; then
        read -rp "System username [${APP_USER_DEFAULT}]: " APP_USER || true; APP_USER=${APP_USER:-$APP_USER_DEFAULT}
    else
        APP_USER=$(whoami)
    fi
    # Detect existing web servers
    local has_nginx has_apache
    if is_pkg_installed nginx; then has_nginx=y; else has_nginx=n; fi
    if is_pkg_installed apache2; then has_apache=y; else has_apache=n; fi

    say "Web server detection: Nginx=${has_nginx} Apache=${has_apache}"
    if [ "$has_nginx" = "y" ] && [ "$has_apache" = "y" ]; then
        echo "Choose web server to use:"
        echo "  1) Nginx (recommended)"
        echo "  2) Apache"
        echo "  3) None"
        read -rp "Selection [1]: " WS_CHOICE || true; WS_CHOICE=${WS_CHOICE:-1}
        case "$WS_CHOICE" in
            1) WEB_SERVER=nginx ;;
            2) WEB_SERVER=apache ;;
            *) WEB_SERVER=none ;;
        esac
    elif [ "$has_nginx" = "y" ]; then
        read -rp "Use existing Nginx to serve the frontend? [Y/n]: " ANS || true; ANS=$(echo "${ANS:-Y}" | tr '[:upper:]' '[:lower:]')
        WEB_SERVER=$([ "$ANS" = "n" ] && echo none || echo nginx)
    elif [ "$has_apache" = "y" ]; then
        read -rp "Use existing Apache to serve the frontend? [Y/n]: " ANS || true; ANS=$(echo "${ANS:-Y}" | tr '[:upper:]' '[:lower:]')
        WEB_SERVER=$([ "$ANS" = "n" ] && echo none || echo apache)
    else
        echo "No web server found. Install one?"
        echo "  1) Install Apache (recommended)"
        echo "  2) Install Nginx"
        echo "  3) None (I'll serve the build myself)"
        read -rp "Selection [1]: " WS_CHOICE || true; WS_CHOICE=${WS_CHOICE:-1}
        case "$WS_CHOICE" in
            1) WEB_SERVER=apache ;;
            2) WEB_SERVER=nginx ;;
            *) WEB_SERVER=none ;;
        esac
    fi
    read -rp "Database name [finx_db]: " DB_NAME || true; DB_NAME=${DB_NAME:-finx_db}
    read -rp "Database user [finx_user]: " DB_USER || true; DB_USER=${DB_USER:-finx_user}
}

create_user_if_needed() {
    if [ "${CREATE_USER}" = "y" ]; then
        if id -u "$APP_USER" >/dev/null 2>&1; then
            ok "User $APP_USER exists"
        else
            say "Creating system user $APP_USER"
            $SUDO useradd -r -m -d "/home/${APP_USER}" -s /usr/sbin/nologin "$APP_USER"
        fi
        $SUDO chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
    fi
}

create_db() {
    say "Ensuring database and user exist"
    local DB_PASS
    if run_as_user postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
        ok "DB user ${DB_USER} exists"
    else
        DB_PASS="$(generate_secret)"
        run_as_user postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
SQL
        ok "Created DB user ${DB_USER}"
        CREATED_DB_USER="y"
    fi
    if run_as_user postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
        ok "DB ${DB_NAME} exists"
    else
        run_as_user postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
        ok "Created DB ${DB_NAME}"
        CREATED_DB="y"
    fi

    # Fetch password for existing user if needed
    if [ -z "${DB_PASS:-}" ]; then
        # Can't query pg to retrieve password; if ENV exists, we'll use that; else prompt
        if [ -f "$ENV_FILE" ]; then
            # shellcheck disable=SC1090
            source "$ENV_FILE"
            DB_PASS="$DB_PASSWORD"
        fi
        if [ -z "${DB_PASS:-}" ]; then
            read -rsp "Enter password for existing DB user ${DB_USER}: " DB_PASS; echo
        fi
    fi
    export DB_PASSWORD="$DB_PASS"
}

create_env() {
    # If env already exists in update mode, keep it
    if [ "$UPDATE_MODE" = "y" ] && [ -f "$ENV_FILE" ]; then
        ok "Keeping existing environment file at ${ENV_FILE}"
        return 0
    fi
    say "Generating environment file at ${ENV_FILE}"
    # Build CORS_ORIGIN list locally (avoid relying on outer scope with set -u)
    local ORIGINS=""
    if [ -n "${DOMAIN:-}" ]; then
        # Use provided domain (both schemes), plus port-qualified HTTP if non-standard port
        ORIGINS="https://${DOMAIN},http://${DOMAIN}"
        if [ -n "${FRONTEND_PORT:-}" ] && [ "${FRONTEND_PORT}" != "80" ] && [ "${FRONTEND_PORT}" != "443" ]; then
            ORIGINS="${ORIGINS},http://${DOMAIN}:${FRONTEND_PORT}"
        fi
    else
        # No domain provided: default to localhost/loopback with the chosen port
        if [ -n "${FRONTEND_PORT:-}" ]; then
            if [ "${FRONTEND_PORT}" = "80" ]; then
                ORIGINS="http://localhost,http://127.0.0.1"
            elif [ "${FRONTEND_PORT}" = "443" ]; then
                ORIGINS="https://localhost,https://127.0.0.1"
            else
                ORIGINS="http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}"
            fi
        else
            # Fallback if port is not set for some reason
            ORIGINS="http://localhost,http://127.0.0.1"
        fi
    fi
    local JWT_SECRET
    JWT_SECRET=$(generate_secret)
    $SUDO mkdir -p "$ENV_DIR"
    $SUDO bash -c "cat > '${ENV_FILE}'" <<EOF
# FinX environment
NODE_ENV=production
PORT=${PORT}

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}

# CORS
CORS_ORIGIN=${ORIGINS}

# Feature flags
DISABLE_REGISTRATION=true
EOF
    $SUDO chmod 640 "$ENV_FILE"
    if [ "${CREATE_USER}" = "y" ]; then
        $SUDO chown ${APP_USER}:root "$ENV_FILE"
    fi
    ok "Wrote ${ENV_FILE}"
    CREATED_ENV_FILE="y"
}

install_dependencies() {
    say "Installing backend dependencies"
    if [ "${CREATE_USER}" = "y" ]; then
                (
                    if [ -f "$APP_DIR/package-lock.json" ] || [ -f "$APP_DIR/npm-shrinkwrap.json" ]; then
                        run_as_user_in_dir "$APP_USER" "$APP_DIR" npm ci --omit=dev
                    else
                        run_as_user_in_dir "$APP_USER" "$APP_DIR" npm install --omit=dev
                    fi
                )
    else
                (
                    if [ -f "$APP_DIR/package-lock.json" ] || [ -f "$APP_DIR/npm-shrinkwrap.json" ]; then
                        ( cd "$APP_DIR" && npm ci --omit=dev )
                    else
                        ( cd "$APP_DIR" && npm install --omit=dev )
                    fi
                )
    fi
    say "Installing frontend dependencies and building"
    if [ "${CREATE_USER}" = "y" ]; then
                (
                    if [ -f "$APP_DIR/frontend/package-lock.json" ] || [ -f "$APP_DIR/frontend/npm-shrinkwrap.json" ]; then
                        run_as_user_in_dir "$APP_USER" "$APP_DIR/frontend" npm ci
                    else
                        run_as_user_in_dir "$APP_USER" "$APP_DIR/frontend" npm install
                    fi && \
                    # Ensure previous build output is removed to avoid stale precache entries
                    run_as_user_in_dir "$APP_USER" "$APP_DIR/frontend" bash -lc 'rm -rf build' && \
                    run_as_user_in_dir "$APP_USER" "$APP_DIR/frontend" npm run build && \
                    # Ensure icons and logos exist in build output (robust against toolchain changes)
                    run_as_user_in_dir "$APP_USER" "$APP_DIR/frontend" bash -lc '[ -d public/icons ] && mkdir -p build/icons && cp -rn public/icons/* build/icons/ || true; [ -d public/logos ] && mkdir -p build/logos && cp -rn public/logos/* build/logos/ || true; [ -f public/icons/favicon.ico ] && cp -n public/icons/favicon.ico build/icons/favicon.ico || true'
                )
    else
                (
                    cd "$APP_DIR/frontend" && \
                    if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
                        npm ci
                    else
                        npm install
                    fi && \
                    # Ensure previous build output is removed to avoid stale precache entries
                    bash -lc 'rm -rf build' && \
                    npm run build && \
                    # Ensure icons and logos exist in build output (robust against toolchain changes)
                    bash -lc '[ -d public/icons ] && mkdir -p build/icons && cp -rn public/icons/* build/icons/ || true; [ -d public/logos ] && mkdir -p build/logos && cp -rn public/logos/* build/logos/ || true; [ -f public/icons/favicon.ico ] && cp -n public/icons/favicon.ico build/icons/favicon.ico || true'
                )
    fi
    ok "Dependencies installed and frontend built"
}

run_migrations() {
    say "Running database migrations"
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
    # If repo has no migrations directory or contains no .sql files, skip gracefully
    local MIG_DIR
    MIG_DIR="${APP_DIR}/database/migrations"
    if [ ! -d "$MIG_DIR" ] || ! ls -1 "$MIG_DIR"/*.sql >/dev/null 2>&1; then
        echo "No migrations directory or SQL files found at $MIG_DIR; skipping."
        return 0
    fi
    if [ "${CREATE_USER}" = "y" ]; then
                (
                    run_as_user_in_dir "$APP_USER" "$APP_DIR" env $(grep -E '^[A-Z_]+=' "$ENV_FILE" | xargs) npm run migrate-db
                )
    else
                (
                    cd "$APP_DIR" && \
                    env $(grep -E '^[A-Z_]+=' "$ENV_FILE" | xargs) npm run migrate-db
                )
    fi
    ok "Migrations applied"
}

create_systemd_service() {
    say "Creating systemd service ${SERVICE_FILE}"
    local RUN_USER RUN_GROUP
    if [ "${CREATE_USER}" = "y" ]; then
        RUN_USER="$APP_USER"; RUN_GROUP="$APP_USER"
    else
        RUN_USER="$(whoami)"; RUN_GROUP="$(id -gn)"
    fi
    $SUDO bash -c "cat > '${SERVICE_FILE}'" <<EOF
[Unit]
Description=FinX API Service
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=$(command -v node) ${APP_DIR}/server.js
Restart=always
RestartSec=3
User=${RUN_USER}
Group=${RUN_GROUP}
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable "${APP_NAME}.service"
    ok "Systemd service installed"
    CREATED_SERVICE="y"
}

create_nginx_site() {
    [ "${WEB_SERVER}" = "nginx" ] || return 0
    # Skip if site already exists (update mode)
    if [ -f "${NGINX_SITE_AVAILABLE}" ]; then
        ok "Nginx site already present; skipping reconfiguration"
        return 0
    fi
    say "Configuring Nginx site"
    local SERVER_NAME
    SERVER_NAME=${DOMAIN:-_}
    # Ensure a frontend port is chosen
    if [ -z "${FRONTEND_PORT}" ]; then
        choose_frontend_port 3000
    fi
    $SUDO bash -c "cat > '${NGINX_SITE_AVAILABLE}'" <<'EOF'
server {
        listen __WEB_PORT__;
        server_name __SERVER_NAME__;

    # Serve frontend build
        root __APP_DIR__/frontend/build;
        index index.html;

    charset utf-8;

        # Gzip + cache static assets
        gzip on;
        gzip_types text/plain text/css application/javascript application/json image/svg+xml application/font-woff2;
        gzip_min_length 1024;

    location /assets/ {
                expires 30d;
                add_header Cache-Control "public, max-age=2592000, immutable";
                try_files $uri =404;
        }

    # Icon and logo directories
    location /icons/ {
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    location /logos/ {
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Favicon root path
    location = /favicon.ico {
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri /icons/favicon.ico =404;
    }

    # PWA files
    location = /manifest.webmanifest {
        # Scope MIME override to this location only
        types { }
        default_type application/manifest+json;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires -1;
        try_files $uri /manifest.webmanifest =404;
    }
    # Hashed manifest emitted by VitePWA lives under /assets
    location ~ ^/assets/.*\.webmanifest$ {
        types { }
        default_type application/manifest+json;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires -1;
        try_files $uri =404;
    }
        # Service worker should never be cached aggressively to allow instant updates
        location = /sw.js {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            expires -1;
            try_files $uri /sw.js =404;
        }
        location ~ ^/workbox-.*\.js$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            expires -1;
            try_files $uri =404;
        }

        # API proxy
        location /api/ {
                proxy_pass http://127.0.0.1:__PORT__;
                proxy_http_version 1.1;
                proxy_set_header Host $host;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
                proxy_read_timeout 60s;
        }

    # WebSockets (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }

        # SPA fallback
    location / {
            try_files $uri /index.html;
            # Prevent caching HTML so clients pick up new asset URLs immediately
            location ~* \.html$ {
                add_header Cache-Control "no-cache, no-store, must-revalidate";
                expires -1;
            }
    }
}
EOF
    # Replace placeholders
    $SUDO sed -i "s#__SERVER_NAME__#${SERVER_NAME}#g" "$NGINX_SITE_AVAILABLE"
    $SUDO sed -i "s#__APP_DIR__#${APP_DIR//\//\/}#g" "$NGINX_SITE_AVAILABLE"
    $SUDO sed -i "s#__PORT__#${PORT}#g" "$NGINX_SITE_AVAILABLE"
    $SUDO sed -i "s#__WEB_PORT__#${FRONTEND_PORT}#g" "$NGINX_SITE_AVAILABLE"

    # Enable site
    [ -e "$NGINX_SITE_ENABLED" ] || $SUDO ln -s "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
    $SUDO nginx -t
    $SUDO systemctl reload nginx
    ok "Nginx configured for ${SERVER_NAME}"
    CREATED_NGINX_SITE="y"
}

create_apache_site() {
    [ "${WEB_SERVER}" = "apache" ] || return 0
    # Skip if site already exists (update mode)
    if [ -f "/etc/apache2/sites-available/${APP_NAME}.conf" ]; then
        ok "Apache site already present; skipping reconfiguration"
        return 0
    fi
    say "Configuring Apache site"
    local SERVER_NAME
    SERVER_NAME=${DOMAIN:-localhost}
    local APACHE_SITE="/etc/apache2/sites-available/${APP_NAME}.conf"
    # Ensure a frontend port is chosen
    if [ -z "${FRONTEND_PORT}" ]; then
        choose_frontend_port 3000
    fi
    # Ensure Apache listens on the chosen port
    if ! grep -RhoE "^Listen[[:space:]]+${FRONTEND_PORT}($|[[:space:]])" /etc/apache2/ports.conf 2>/dev/null | grep -q .; then
        echo "Listen ${FRONTEND_PORT}" | $SUDO tee -a /etc/apache2/ports.conf >/dev/null
        APPENDED_APACHE_PORT="y"
    fi
    $SUDO bash -c "cat > '${APACHE_SITE}'" <<'EOF'
<VirtualHost *:__WEB_PORT__>
        ServerName __SERVER_NAME__
        DocumentRoot __APP_DIR__/frontend/build

    <Directory "__APP_DIR__/frontend/build">
        # Disable MultiViews to prevent content negotiation returning HTML for JS files
        Options -MultiViews +Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    # Ensure icons and logos are served from the build directory even if other rewrites interfere
    Alias /icons/ "__APP_DIR__/frontend/build/icons/"
    Alias /logos/ "__APP_DIR__/frontend/build/logos/"
    <Directory "__APP_DIR__/frontend/build/icons">
        Require all granted
        Options -MultiViews +FollowSymLinks
    </Directory>
    <Directory "__APP_DIR__/frontend/build/logos">
        Require all granted
        Options -MultiViews +FollowSymLinks
    </Directory>

    # MIME types for modern assets
    AddType application/javascript .js .mjs
    AddType application/manifest+json .webmanifest
    AddType text/css .css

        # Cache static assets
        <LocationMatch "^/assets/">
                Header set Cache-Control "public, max-age=2592000, immutable"
        </LocationMatch>

    # Icons and logos
    <LocationMatch "^/(icons|logos)/">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>

    # Favicon root path
    <Files "favicon.ico">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Files>

        # PWA files
        <FilesMatch "^(manifest\.webmanifest|sw\.js|workbox-.*\.js)$">
                Header set Cache-Control "no-cache"
        </FilesMatch>

    # SPA fallback (only when request is not a real file or directory)
        RewriteEngine On
        # Do not rewrite API or WebSocket endpoints
        RewriteCond %{REQUEST_URI} !^/api/
        RewriteCond %{REQUEST_URI} !^/socket\.io/
        # Do not rewrite static assets or PWA files
    RewriteCond %{REQUEST_URI} !^/assets/
    RewriteCond %{REQUEST_URI} !^/icons/
    RewriteCond %{REQUEST_URI} !^/logos/
        RewriteCond %{REQUEST_URI} !^/sw\.js$
        RewriteCond %{REQUEST_URI} !^/workbox-.*\.js$
        RewriteCond %{REQUEST_URI} !\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest)$
        # Only rewrite if the request isn't a real file or directory
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ /index.html [L]

        # API proxy
        ProxyPreserveHost On
        ProxyPass /api http://127.0.0.1:__PORT__/api
        ProxyPassReverse /api http://127.0.0.1:__PORT__/api

    # WebSockets (Socket.IO)
    ProxyPass "/socket.io/"  "ws://127.0.0.1:__PORT__/socket.io/"
    ProxyPassReverse "/socket.io/"  "ws://127.0.0.1:__PORT__/socket.io/"

        # Gzip
        AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json image/svg+xml
</VirtualHost>
EOF
    $SUDO sed -i "s#__SERVER_NAME__#${SERVER_NAME}#g" "$APACHE_SITE"
    $SUDO sed -i "s#__APP_DIR__#${APP_DIR//\//\/}#g" "$APACHE_SITE"
    $SUDO sed -i "s#__PORT__#${PORT}#g" "$APACHE_SITE"
    $SUDO sed -i "s#__WEB_PORT__#${FRONTEND_PORT}#g" "$APACHE_SITE"

    $SUDO a2enmod proxy proxy_http proxy_wstunnel headers rewrite deflate mime expires >/dev/null 2>&1 || true
    $SUDO a2ensite "${APP_NAME}.conf" >/dev/null 2>&1 || true
    $SUDO apache2ctl configtest
    $SUDO systemctl reload apache2
    ok "Apache configured for ${SERVER_NAME}"
    CREATED_APACHE_SITE="y"
}

start_services() {
    say "Starting ${APP_NAME} service"
    $SUDO systemctl restart "${APP_NAME}.service"
    $SUDO systemctl status "${APP_NAME}.service" --no-pager -l || true
    STARTED_SERVICE="y"
}

seed_admin_and_capture_credentials() {
    say "Seeding admin (first install) and capturing credentials"
    # Export env for Node process
    set -a; source "$ENV_FILE"; set +a
    local TMP_LOG
    TMP_LOG="$(mktemp -t finx-init-db-XXXX.log)"
    local INIT_RC
    if [ "${CREATE_USER}" = "y" ]; then
        (
            run_as_user_in_dir "$APP_USER" "$APP_DIR" env $(grep -E '^[A-Z_]+=' "$ENV_FILE" | xargs) npm run init-db
        ) >"$TMP_LOG" 2>&1
        INIT_RC=$?
    else
        (
            cd "$APP_DIR" && \
            env $(grep -E '^[A-Z_]+=' "$ENV_FILE" | xargs) npm run init-db
        ) >"$TMP_LOG" 2>&1
        INIT_RC=$?
    fi

    if [ "${DEBUG_SETUP:-}" = "1" ]; then
        say "init-db exit code: ${INIT_RC}"
        say "init-db log file: ${TMP_LOG}"
        echo "----- BEGIN init-db LOG (first 200 lines) -----"
        sed -n '1,200p' "$TMP_LOG" || true
        echo "----- END init-db LOG -----"
    fi

    # Extract friendly-printed credentials from seeder output (if a new admin was created)
    ADMIN_EMAIL=$(grep -m1 -E '^\s*Email:\s*' "$TMP_LOG" | sed -E 's/^\s*Email:\s*//') || ADMIN_EMAIL=""
    ADMIN_PASSWORD=$(grep -m1 -E '^\s*Password:\s*' "$TMP_LOG" | sed -E 's/^\s*Password:\s*//') || ADMIN_PASSWORD=""

    # Fallback: parse JSON array output if pretty lines weren't found
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
        if grep -q "\[\s*{\s*\"email\"" "$TMP_LOG"; then
            ADMIN_EMAIL=$(grep -oE '"email"\s*:\s*"[^"]+"' "$TMP_LOG" | head -n1 | sed -E 's/.*"email"\s*:\s*"([^"]+)".*/\1/')
            ADMIN_PASSWORD=$(grep -oE '"password"\s*:\s*"[^"]+"' "$TMP_LOG" | head -n1 | sed -E 's/.*"password"\s*:\s*"([^"]+)".*/\1/')
        fi
    fi
    if [ -n "${ADMIN_EMAIL}" ] && [ -n "${ADMIN_PASSWORD}" ]; then
        CREDENTIALS_FOUND="y"
    else
        if [ "${DEBUG_SETUP:-}" = "1" ]; then
            warn "Could not parse admin credentials from init-db output. Diagnostics:"
            echo " - Found 'Admin Credentials' header: $(grep -c 'Admin Credentials' "$TMP_LOG" || true)"
            echo " - Found 'Email:' lines: $(grep -c '^\s*Email:' "$TMP_LOG" || true)"
            echo " - Found 'Password:' lines: $(grep -c '^\s*Password:' "$TMP_LOG" || true)"
            echo " - Found JSON creds blocks: $(grep -c '"email".*"password"' "$TMP_LOG" || true)"
            echo "----- TAIL init-db LOG (last 80 lines) -----"
            tail -n 80 "$TMP_LOG" || true
            echo "----- END TAIL -----"
        fi
        CREDENTIALS_FOUND="n"
    fi
    # Preserve log when debugging; otherwise clean up
    if [ "${DEBUG_SETUP:-}" = "1" ]; then
        warn "DEBUG_SETUP=1 set, preserving log at ${TMP_LOG}"
    else
        rm -f "$TMP_LOG"
    fi
}

summary() {
    echo
    ok "Installation complete"
    echo ""
    echo "Environment: ${ENV_FILE}"
    echo "Service: systemctl status ${APP_NAME}"
    echo "API: http://localhost:${PORT}/health"
    case "${WEB_SERVER}" in
        nginx)
            echo "Frontend served via Nginx at: http://${DOMAIN:-localhost}:${FRONTEND_PORT}/" ;;
        apache)
            echo "Frontend served via Apache at: http://${DOMAIN:-localhost}:${FRONTEND_PORT}/" ;;
        *)
            echo "Serve the frontend build directory (frontend/build) with any web server; API on port ${PORT}" ;;
    esac
    if [ "${CREDENTIALS_FOUND:-n}" = "y" ]; then
        echo ""
        echo "Admin credentials (shown once):"
        echo "  Email: ${ADMIN_EMAIL}"
        echo "  Password: ${ADMIN_PASSWORD}"
        echo "Save these now; they won't be shown again."
    fi
}

main() {
    need_sudo
    setup_traps
    detect_os
    if [ -f "$ENV_FILE" ] || [ -f "$SERVICE_FILE" ]; then
        UPDATE_MODE="y"
        load_existing_settings
    else
        prompt_inputs
    fi
    # Create system user early (if requested) so subsequent steps can run chown/clone as that user
    ensure_system_user
    ensure_repo
    install_node
    install_postgres
    install_web_server
    # Pick a frontend port before creating vhosts
    choose_frontend_port 3000
    create_user_if_needed
    create_db
    create_env
    install_dependencies
    run_migrations
    seed_admin_and_capture_credentials
    create_systemd_service
    if [ "$UPDATE_MODE" != "y" ]; then
        create_nginx_site
        create_apache_site
    else
        ok "Skipping web server site creation (update mode)"
    fi
    start_services
    summary
    COMPLETED="y"
    # Clear traps on success
    trap - ERR INT TERM
}

main "$@"
