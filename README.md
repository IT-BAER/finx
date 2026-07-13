<div align="center">

# FinX - Personal Finance Tracker

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Backend-Express-informational.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791.svg)](https://www.postgresql.org/)
![Open Source](https://img.shields.io/badge/Open%20Source-Free-brightgreen.svg)

Self-hosted personal finance tracker: a React web frontend with a Node.js/PostgreSQL backend, plus a native Android app.

Your database, your server, your transactions. FinX has no cloud component; everything runs on hardware you control.

<a href="https://play.google.com/store/apps/details?id=com.baer.finx" target="_blank"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="80"></a>

</div>

---

## Table of Contents

- [Key Features](#-key-features)
- [Requirements](#-requirements)
- [Configuration](#%EF%B8%8F-configuration-environment)
- [Quick Install](#-quick-installupdate)
  - [Docker Compose](#-docker-compose)
  - [Debian/Ubuntu](#-debianubuntu-no-docker---interactive-installerupdater)
  - [Development](#-development-windowsmacoslinux)
- [Update/Upgrade](#-updateupgrade)
- [Management](#%EF%B8%8F-management)
- [Uninstall](#-uninstall)
- [Troubleshooting](#-troubleshooting)
- [First Run & Admin Account](#-first-run--admin-account)
- [Data Import](#-data-import)
- [Tested Systems](#%EF%B8%8F-tested-systems)
- [Tech Stack](#-tech-stack)
- [Offline & Connectivity](#-offline--connectivity)
- [Security](#-security)
- [Mobile App](#-mobile-app)
- [Learn More](#-learn-more)
- [License](#-license)
- [Support Development](#-support-development)

---

## ✨ Key Features

- **Realtime updates**: Transaction changes propagate to other devices via SSE; Dashboard and Reports refresh without a reload
- **Transactions** with categories, sources, targets; imports with duplicate detection
- **Recurring rules** and background processor (systemd scheduler supported)
- **Sharing** with fine-grained `can_edit` access; visibility enforced server-side
- **Admin taxonomy management** (categories/sources/targets)
- **Express API** with JWT auth; PostgreSQL persistence
- **Offline capture**: Add transactions while disconnected; they sync when the connection resumes

---

## 🧰 Requirements

- Docker Desktop (Windows/macOS) or Docker Engine (Linux) with Docker Compose (for Docker setup)
- Debian/Ubuntu (for non-Docker setup)
- Node.js 20.19+ (for local builds and the Debian installer; aligns with Vite 6 runtime requirement)
- Open ports: 3000 (frontend)
- curl
- ~300MB+ free disk space for images and DB volume

---

## ⚙️ Configuration (Environment)

Backend environment file location differs by setup:
- **Docker**: `.env` (repo root)
- **Debian/Ubuntu installer**: `/etc/finx/finx.env`

| Key | Description |
|-----|-------------|
| `PORT` | API port (default 5000) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | Required; set a strong random value |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `DISABLE_REGISTRATION` | Set `true` to block open signups (recommended) |
| `DEV_MODE` | Set `true` for auto-login in dev only (don't use in prod) |
| `OPENROUTER_API_KEY` | Optional; enables managed AI notification parsing in the mobile app (get key at openrouter.ai) |

**Frontend build flags** (optional):
- `VITE_DEV_MODE`: Pairs with backend `DEV_MODE` for local dev

---

## 🚀 Quick Install/Update

### 🐋 Docker Compose

```bash
git clone https://github.com/IT-BAER/finx.git
cd finx

# 1) Edit .env with your values
#    Required: DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET
#    Recommended: DISABLE_REGISTRATION=true

# 2) Start services
docker compose up -d --build
```

App: http://localhost:3000 • API: proxied at /api

### 🐧 Debian/Ubuntu (no Docker) - Interactive Installer/Updater

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/IT-BAER/finx/main/setup.sh)"
```

What it does:
- Installs Node.js LTS and PostgreSQL
- Creates DB/user and writes `/etc/finx/finx.env`
- Builds the frontend
- Creates systemd service `finx.service`
- Configures Nginx or Apache on request

See `docs/DEPLOY-DEBIAN.md` for details.

**Release installs** (optional):
```bash
# Install a specific release tag
FINX_REF=v1.2.3 bash setup.sh

# Install from an archive URL
FINX_ARCHIVE_URL=https://example.com/finx-v1.2.3.tar.gz bash setup.sh
```

### 💻 Development (Windows/macOS/Linux)

```bash
npm install && (cd frontend && npm install)
npm run dev-start
# Or full helper that prints LAN URL
./scripts/dev-full.sh
```

Frontend on http://localhost:3000 with API proxied to http://localhost:5000.

---

## 🔄 Update/Upgrade

**Docker:**
```bash
git pull
docker compose pull
docker compose build --no-cache
docker compose up -d
docker compose exec backend npm run migrate-db
```

**Debian/Ubuntu installer:**
Re-run the one-liner; it detects an existing install and updates in place.
```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/IT-BAER/finx/main/setup.sh)"
```

---

## 🛠️ Management

**Docker:**
```bash
docker compose ps
docker compose logs -f backend frontend
docker compose exec backend npm run migrate-db
```

**Linux (systemd):**
```bash
sudo systemctl status finx
sudo journalctl -u finx -f
sudo systemctl restart finx
```

---

## 🧹 Uninstall

### Debian/Ubuntu

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/IT-BAER/finx/main/uninstall.sh)"
```

Removes by default:
- systemd service `finx.service`
- Nginx/Apache site configs
- PostgreSQL database and role for FinX
- `/etc/finx` environment directory
- Application directory (`/opt/finx`)
- Dedicated `finx` system user

**Flags to keep resources:**
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

---

## 🚨 Troubleshooting

**Service won't start (Linux):**
```bash
sudo systemctl status finx --no-pager
sudo journalctl -u finx --no-pager -n 200
```

**DB connection:** Verify values in `/etc/finx/finx.env` (or `.env` in dev). Ensure PostgreSQL is running and credentials match.

**Migrations:**
```bash
npm run migrate-db
```

**Port conflicts:** API uses `PORT` (default 5000). Change in env file or stop other services.

---

## 👤 First Run & Admin Account

- **Docker**: Check backend container logs; it prints generated admin credentials on fresh installs.
- **Debian/Ubuntu installer**: The setup runs init and prints credentials once.
- If an admin already exists, credentials won't be reprinted; create new users from the UI.

---

## 📥 Data Import

- Import CSV from the UI (Settings page) and map the columns.
- **Date format**: `YYYY-MM-DD`
- **Amount**: Plain number using dot decimal
- **Types**: `income` or `expense` (CSV value `Withdrawal` is mapped to `expense`)
- **Duplicate detection** prevents re-importing the same entry (matches user+date+amount+type+normalized fields)

---

## 🖥️ Tested Systems

| System | Version | API | Frontend |
|--------|---------|:---:|:--------:|
| Debian | 12+ | ✅ | ✅ |
| Ubuntu | 22.04+ | ✅ | ✅ |
| Docker Desktop (Windows 11) | latest | ✅ | ✅ |
| WSL2 (dev) | Ubuntu 22.04 | ✅ | ✅ |
| Android (Chrome) | 16 | ✅ | ✅ |
| Chrome (Desktop) | latest | ✅ | ✅ |

---

## 🧱 Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 19 + Vite 6 | Fast dev/build |
| TanStack React Query 5 | Server state management |
| TypeScript 5.8 | Type safety |
| React Router 7 | Routing |
| Tailwind CSS 3 | Styling |
| Framer Motion 12 | Animations |
| Chart.js 4 | Data visualization |
| react-hot-toast | Notifications |

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js 20, Express 4 | REST API |
| PostgreSQL 15 | Database |
| Zod 3 | Request validation |
| JWT + bcryptjs | Authentication |
| helmet, cors, rate-limit | Security |

### Architecture

- Express routes → controllers → models; DB in `config/db.js`
- Auth middleware in `middleware/auth.js`; optional `DEV_MODE` for local auto-login
- Sharing/permissions in `utils/access.js`; controllers compute `can_edit`
- Frontend API client in `frontend/src/services/api.jsx` (axios, JWT header, 401 redirect)
- Offline layer in `frontend/src/services/offlineAPI.js` (GET caching + queued mutations)
- Server connectivity in `frontend/src/services/connectivity.js` (health polling)

---

## 📶 Offline & Connectivity

- **Server-based connectivity**: The app counts as "online" only when the server answers `GET /api/health`
- **Health polling**: Checks every ~8s when online, retries faster after failures
- **Offline detection**: Switches to offline after 2 consecutive failed checks
- **Queued mutations**: Transactions added offline are queued and synced when the connection resumes

### Realtime Updates (SSE)

- Backend exposes a Server-Sent Events stream at `/api/events`
- Transaction create/update/delete broadcasts to the owner and shared users
- Dashboard and Reports refresh without a reload
- Connection adapts to tab visibility with exponential-backoff reconnect

**Reverse proxy tip:** Disable buffering for `/api/events` (e.g., `proxy_buffering off;` in Nginx).

### Connectivity Tuning

Optional environment variables for `frontend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_CONN_DEFAULT_MS` | 8000 | Interval when online |
| `VITE_CONN_SHORT_RETRY_MS` | 2000 | Retry interval after failure |
| `VITE_CONN_OFFLINE_RETRY_MS` | 3000 | Interval while offline |
| `VITE_CONN_FAILURE_THRESHOLD` | 2 | Consecutive failures to mark offline |
| `VITE_CONN_TIMEOUT_MS` | 2500 | Per-check timeout |

---

## 🔒 Security

| Recommendation | Description |
|----------------|-------------|
| Strong `JWT_SECRET` | Use a random, high-entropy value |
| HTTPS | Run behind Nginx/Apache reverse proxy with SSL |
| `DISABLE_REGISTRATION=true` | Block open signups for closed deployments |
| Database least privilege | Dedicated app user owns only app DB |
| `CORS_ORIGIN` | Set to your frontend origin |

---

## 📱 Mobile App

FinX has a native Android app:

<a href="https://play.google.com/store/apps/details?id=com.baer.finx" target="_blank"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="80"></a>

- **Local Mode**: Works fully offline; all data stays on the device, no server required
- **Server Mode**: Connects to your self-hosted FinX backend for sync and sharing
- Login with JWT tokens and biometric quick access
- Offline transaction capture with automatic sync

---

## 📚 Learn More

- Debian/Ubuntu installer details: [docs/DEPLOY-DEBIAN.md](docs/DEPLOY-DEBIAN.md)

---

## 📄 License

Apache-2.0 with the "Commons Clause" restriction. You may use, copy, modify, fork, and redistribute the software under Apache-2.0 terms, except you may not "Sell" the software. "Sell" includes selling access, reselling, sublicensing, or offering the software as a hosted/managed service where the value derives substantially from the software, without a commercial license from IT-BAER.

See full terms in [LICENSE](LICENSE) (Commons Clause v1.0 + Apache-2.0).

---

## 💜 Support Development

If this project helps you, consider supporting this and future work, which heavily relies on coffee:

<div align="center">
<a href="https://www.buymeacoffee.com/itbaer" target="_blank"><img src="https://github.com/user-attachments/assets/64107f03-ba5b-473e-b8ad-f3696fe06002" alt="Buy Me A Coffee" style="height: 60px; max-width: 217px;"></a>
<br>
<a href="https://www.paypal.com/donate/?hosted_button_id=5XXRC7THMTRRS" target="_blank">Donate via PayPal</a>
</div>
