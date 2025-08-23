# FinX — Debian/Ubuntu Install (No Docker)

This guide installs FinX on a Debian/Ubuntu host using Node.js, PostgreSQL, systemd, and optionally Nginx.

## Quick install

Run the interactive installer in the project root:

```bash
sudo bash setup.sh
```

What it does:
- Installs Node.js LTS and PostgreSQL (and Nginx if you opt-in)
- Creates database/user, generates `/etc/finx/finx.env`
- Installs Node deps, builds the frontend
- Creates `finx.service` and starts it
- Configures Nginx to serve `frontend/build` and proxy `/api` (optional)

### Installing a specific release (optional)

You can pin the installer to a tag/commit or provide a release archive URL:

```bash
# Tag or commit
FINX_REF=v1.2.3 sudo bash setup.sh

# Archive (.tar.gz or .zip)
FINX_ARCHIVE_URL=https://your-host/finx-v1.2.3.tar.gz sudo bash setup.sh
```

If you run the installer from within a working tree (already checked out tag/commit), it will use the current directory without cloning.

## Service commands

- Check status: `sudo systemctl status finx`
- Restart: `sudo systemctl restart finx`
- Logs: `journalctl -u finx -f`

## Configuration

- Env file: `/etc/finx/finx.env`
- Frontend build: `frontend/build`
- API health: `http://localhost:5000/health`

## Manual mode (advanced)

1) Install deps: Node.js 20+, PostgreSQL 14+, Nginx (optional)
2) Create DB and user, then set `/etc/finx/finx.env` variables to match
3) From repo root: `npm ci --omit=dev && (cd frontend && npm ci && npm run build)`
4) Run `npm run migrate-db`
5) Start app for testing: `PORT=5000 node server.js`
6) Setup a systemd service and reverse proxy (see the installer as reference)

## SSL / HTTPS

Use certbot to provision TLS and update the Nginx server block accordingly.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain
```

## Uninstall

- Disable service: `sudo systemctl disable --now finx`
- Remove files: `/etc/systemd/system/finx.service`, `/etc/finx/finx.env`, nginx site if added
- Drop DB and user in PostgreSQL if desired

## Automatic database migrations

FinX will automatically apply SQL migrations on service start. Migrations are idempotent and located in `database/migrations`.

Behavior is controlled by the `AUTO_MIGRATE` environment variable in `/etc/finx/finx.env`:

- `AUTO_MIGRATE=true` (default): run migrations on boot
- `AUTO_MIGRATE=false`: skip migrations on boot

To change the behavior, edit the env file and restart the service:

```bash
sudo nano /etc/finx/finx.env
sudo systemctl restart finx
```

You can run migrations manually anytime from the app directory:

```bash
npm run migrate-db
```
