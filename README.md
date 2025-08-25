<div align="center">

# FinX — Personal Finance Tracker (PWA)

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Backend-Express-informational.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791.svg)](https://www.postgresql.org/)
![PWA](https://img.shields.io/badge/PWA-Ready-blueviolet.svg)

<img src="./finx%20-%20banner.jpg" alt="FinX — Self‑Hosted Personal Finance" style="max-width: 100%; height: auto;" />

Modern, offline-capable personal finance app with sharing, recurring transactions, and fast mobile UX.

</div>

## 📚 Table of Contents

<p align="center">
   <a href="#-key-features">✨ Features</a> •
   <a href="#-tech-stack">🧱 Tech Stack</a> •
   <a href="#-requirements">🧰 Requirements</a> •
   <a href="#-quick-install">🚀 Install</a> •
   <a href="#-management">🛠️ Management</a> •
   <a href="#-uninstall">🧹 Uninstall</a> •
   <a href="#-troubleshooting">🚨 Troubleshooting</a> •
   <a href="#-tested-systems">🖥️ Tested</a> •
   <a href="#-security">🔒 Security</a> •
   <a href="#-learn-more">📚 More</a> •
   <a href="#-license">📄 License</a> •
   <a href="#-support-development">💜 Support</a> •
   <a href="#-credits">👏 Credits</a>
  
</p>

<br>

## ✨ Key Features

- Offline-first PWA: read endpoints cached, queued mutations when offline; server reachability-based connectivity (polls `/api/health`)
- Fast mobile UX: early CSS delivery, passive listeners, tuned SW auto-update
- Transactions with categories, sources, targets; imports with duplicate detection
- Recurring rules and background processor (systemd scheduler supported)
- Sharing with fine-grained can_edit access; visibility honored server-side
- Admin taxonomy management (categories/sources/targets)
- Clean Express API with JWT auth; PostgreSQL persistence

<br>

## 🧰 Requirements

- Docker Desktop (Windows/macOS) or Docker Engine (Linux) with Docker Compose (for Docker Setup)
- Debian/Ubuntu (for non-Docker Setup)
- Open ports: 3000 (frontend)
- curl
- ~300MB+ free disk space for images and DB volume

<br>

## 🚀 Quick Install/Update

### 🐋 Docker Compose

```bash
git clone https://github.com/IT-BAER/finx.git
cd finx

# 1) Edit the environment file with your values
#    Required keys: DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET
#    Optional: DISABLE_REGISTRATION=true (recommended for closed deployments)
#    File: .env (already present in the repo)

# 2) Start services
docker compose up -d --build

# 3) First run initialization (usually automatic). If needed, run manually:
# docker-compose exec backend npm run init-db

```

App: http://localhost:3000 • API: proxied at /api

<br>

### 🐧 Debian/Ubuntu (no Docker) — Interactive Installer/Updater

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/IT-BAER/finx/main/setup.sh)"
```

What it does: installs Node.js LTS and PostgreSQL, creates DB/user, writes `/etc/finx/finx.env`, builds the frontend, creates a `systemd` service `finx.service`, and configures Nginx or Apache on request. See `docs/DEPLOY-DEBIAN.md` for details.

Release installs (optional):
- Specific tag/commit via git: set `FINX_REF=v1.2.3` (or a commit) before running the installer.
- Release archive: set `FINX_ARCHIVE_URL=https://.../finx-v1.2.3.tar.gz` to install from a tar/zip archive.

Examples:
```bash
# Install a specific release tag
FINX_REF=v1.2.3 bash setup.sh

# Install from an archive URL (tar.gz or zip)
FINX_ARCHIVE_URL=https://example.com/finx-v1.2.3.tar.gz bash setup.sh
```

<br>

### 💻 Development (Windows/macOS/Linux)

```bash
# Backend + Frontend dev helpers
npm install && (cd frontend && npm install)
npm run dev-start
# Or full helper that prints LAN URL
./scripts/dev-full.sh
```

Frontend on http://localhost:3000 with API proxied to http://localhost:5000.

<br>

## 🛠️ Management

### Docker
```bash
docker compose ps
docker compose logs -f backend frontend
docker compose exec backend npm run migrate-db
```

### Linux (systemd)
```bash
sudo systemctl status finx
sudo journalctl -u finx -f
sudo systemctl restart finx
```

<br>

## 🧹 Uninstall

### Debian/Ubuntu (setup.sh installs)

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/IT-BAER/finx/main/uninstall.sh)"
```

Removes by default:
- systemd service `finx.service`
- Nginx/Apache site configs (and reloads the server)
- PostgreSQL database and role for FinX
- `/etc/finx` environment directory
- Application directory (defaults to `/opt/finx`)
- Dedicated `finx` system user (if it matches FinX’s service user)

Note:
- Apache defaults (`Listen 80`/`Listen 443`) are preserved; only custom `Listen` ports created by the installer are removed.

Flags to keep resources:
- `--keep-db` `--keep-user` `--keep-env` `--keep-code` • `--purge` to force code deletion if the path looks non-standard

Examples:
```bash
# Keep DB and user, remove everything else
sudo bash uninstall.sh --keep-db --keep-user

# Force delete a non-standard install directory
sudo bash uninstall.sh --purge
```

### Docker Compose

```bash
docker-compose down -v
```

This stops and removes containers, network, and the DB volume.

<br>

## 🚨 Troubleshooting

**Service won’t start (Linux):**
```bash
sudo systemctl status finx --no-pager
sudo journalctl -u finx --no-pager -n 200
```

**DB connection:** verify values in `/etc/finx/finx.env` (or `.env` in dev). Ensure PostgreSQL is running and credentials match.

**Migrations:**
```bash
npm run migrate-db
```

**Port conflicts:** API uses `PORT` (default 5000). Change in env file or stop other services.

<br>

## 🖥️ Tested Systems

| System | Version | API | Frontend | PWA |
|---|---|---|---|---|
| Debian | 12+ | ✅ | ✅ | ✅ |
| Ubuntu | 22.04+ | ✅ | ✅ | ✅ |
| Docker Desktop (Windows 11) | latest | ✅ | ✅ | ✅ |
| WSL2 (dev) | Ubuntu 22.04 | ✅ | ✅ | ✅ |
| Android (Chrome) | 16 | ✅ | ✅ | ✅ |
| Chrome (Desktop) | latest | ✅ | ✅ | ✅ |

<br>

## 🧱 Tech Stack

### Frontend

- React 19 + Vite 6 (fast dev/build)
- React Router 7 (routing)
- Tailwind CSS 3, PostCSS, Autoprefixer (styling)
- Framer Motion 12 (micro‑interactions/animations)
- Chart.js 4 + react-chartjs-2 + chartjs-plugin-datalabels (charts)
- Styled‑components 6 (styled Button and small UI pieces)
- Swiper 10 (mobile swipeable page navigation)
- react-hot-toast (notifications)
- PWA via Vite Plugin PWA (Workbox under the hood, offline caching + update prompts)
- Connectivity service monitors server health (`/api/health`) and emits `serverConnectivityChange`

### Backend

- Node.js 20, Express 4 (REST API)
- PostgreSQL via `pg` 8
- AuthN/AuthZ: JWT (`jsonwebtoken`) with password hashing (`bcryptjs`)
- Security and hardening: `helmet`, `cors`, `express-rate-limit`, `compression`
- Background jobs: lightweight in‑process scheduler (`services/scheduler.js`) and recurring transaction processor (`services/recurringProcessor.js`)

### Architecture & Conventions

- Express routes → controllers → models; DB in `config/db.js`
- Auth middleware in `middleware/auth.js`; optional `DEV_MODE` for local auto‑login
- Sharing/permissions in `utils/access.js` and `models/SharingPermission.js`; controllers compute `can_edit`
- Frontend API client in `frontend/src/services/api.jsx` (axios, JWT header, 401 redirect)
- Offline layer in `frontend/src/services/offlineAPI.js` (GET caching + queued mutations)
- Server connectivity source of truth in `frontend/src/services/connectivity.js` (health polling)
- Vite dev proxy `/api` → backend (see `frontend/vite.config.js`)

<br>

## 📶 PWA Offline & Connectivity

- The app considers itself “online” only when the server is reachable.
- A lightweight health endpoint exists at `GET /api/health` returning `{ ok: true, time }`.
- The service worker is configured to never cache `/api/health` (NetworkOnly), ensuring truthful liveness.
- Health polling runs in the client:
   - Default check every ~8s when online, faster retries (~2s) on failures.
   - Switches to offline after 2 consecutive failed checks (timeout ~2.5s each).
   - While offline, it polls every ~3s to detect recovery quickly.
   - Immediate checks on window focus/visibility for snappy recovery/downgrade.
- Components and data layers subscribe to `serverConnectivityChange` so UI state, caches, and queued mutations react instantly.

Tuning (optional, set in `frontend/.env` or env for the Vite build):

```
VITE_CONN_DEFAULT_MS=8000          # interval when online
VITE_CONN_SHORT_RETRY_MS=2000      # retry interval after a failure
VITE_CONN_OFFLINE_RETRY_MS=3000    # interval while offline
VITE_CONN_FAILURE_THRESHOLD=2      # consecutive failures to mark offline
VITE_CONN_TIMEOUT_MS=2500          # per-check timeout
```

### Tooling & Ops

- Docker Compose for local/prod deployments; Nginx serves built frontend (see `frontend/nginx.conf`)
- Scripts: DB migrate/init (`scripts/migrate-db.js`, `scripts/init-db.js`), dev runner (`scripts/dev-start.js`)
- Debian/Ubuntu installer (`setup.sh`) and uninstaller (`uninstall.sh`) with optional web server config

<br>

## 🔒 Security

- Set a strong `JWT_SECRET` in env
- Recommended: run behind HTTPS (Nginx/Apache reverse proxy)
- `DISABLE_REGISTRATION=true` for closed deployments
- Database least privilege: dedicated app user owns app DB only
- CORS: set `CORS_ORIGIN` to your frontend origin

<br>

## 📚 Learn More

- Debian/Ubuntu installer details: `docs/DEPLOY-DEBIAN.md`

<br>

## 📄 License

Apache-2.0 with the “Commons Clause” restriction. You may use, copy, modify, fork, and redistribute the software under Apache-2.0 terms, except you may not “Sell” the software. “Sell” includes selling access, reselling, sublicensing, or offering the software as a hosted/managed service where the value derives substantially from the software, without a commercial license from IT-BAER.

See full terms in `LICENSE` (Commons Clause v1.0 + Apache-2.0). The package manifests use `"SEE LICENSE IN LICENSE"` to reflect this composite license.

<br>

## 💜 Support Development

If this project helps you, consider supporting future work (coffee fuels coding):

<div align="center">
<a href="https://www.buymeacoffee.com/itbaer" target="_blank"><img src="https://github.com/user-attachments/assets/64107f03-ba5b-473e-b8ad-f3696fe06002" alt="Buy Me A Coffee" style="height: 60px; max-width: 217px;"></a>
<br>
<a href="https://www.paypal.com/donate/?hosted_button_id=5XXRC7THMTRRS" target="_blank">Donate via PayPal</a>
</div>

<br>

## 👏 Credits

- React, Vite, Tailwind CSS
- Express, Node.js
- PostgreSQL
- Workbox (via Vite PWA plugin)

