const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

const ROOT = path.resolve(__dirname, "..");
const MAINTENANCE_FLAG = path.join(ROOT, ".maintenance");
const POLL_INTERVAL = parseInt(process.env.UPDATE_POLL_INTERVAL, 10) || 3600_000; // 1 hour default
const FAILURE_COOLDOWN = 5 * 60_000; // 5 minutes after failed update

let currentVersion = null;
let intervalId = null;
let isUpdating = false;
let lastFailedAt = 0;

/**
 * Read the current version from the latest local git tag.
 */
function getCurrentVersion() {
  try {
    return execSync("git describe --tags --abbrev=0", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    // Fallback to package.json version
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      return pkg.version ? `v${pkg.version}` : null;
    } catch {
      return null;
    }
  }
}

/**
 * Fetch the latest release tag from the remote repository via git ls-remote.
 * Only considers semver-style tags (v1.0.0, 1.2.3, etc.).
 */
function fetchLatestTag() {
  const output = execSync("git ls-remote --tags --sort=-v:refname origin", {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 15_000,
  });

  const tags = output
    .split("\n")
    .filter((l) => l.includes("refs/tags/") && !l.includes("^{}"))
    .map((l) => l.replace(/.*refs\/tags\//, "").trim())
    .filter((t) => /^v?\d+\.\d+/.test(t));

  return tags.length > 0 ? tags[0] : null;
}

/**
 * Check for a new release and trigger update if found.
 */
function checkForUpdate() {
  if (isUpdating) return;
  if (lastFailedAt && Date.now() - lastFailedAt < FAILURE_COOLDOWN) return;

  try {
    const latest = fetchLatestTag();
    if (!latest) return;
    if (currentVersion && latest === currentVersion) return;

    logger.info(`[AutoUpdate] New release detected: ${latest} (current: ${currentVersion || "none"})`);
    isUpdating = true;

    const updateScript = path.join(ROOT, "scripts", "update.sh");
    if (!fs.existsSync(updateScript)) {
      logger.error("[AutoUpdate] scripts/update.sh not found — skipping update");
      isUpdating = false;
      return;
    }

    const child = spawn("bash", [updateScript, latest], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, UPDATE_TAG: latest },
    });

    child.stdout.on("data", (d) => logger.info(`[AutoUpdate] ${d.toString().trim()}`));
    child.stderr.on("data", (d) => logger.error(`[AutoUpdate] ${d.toString().trim()}`));

    child.on("close", (code) => {
      if (code === 0) {
        logger.info(`[AutoUpdate] Update to ${latest} completed — systemd will restart the service`);
        // systemctl restart is handled by update.sh; this process will be replaced
      } else {
        logger.error(`[AutoUpdate] Update script exited with code ${code}`);
        try { fs.unlinkSync(MAINTENANCE_FLAG); } catch { /* ignore */ }
        currentVersion = getCurrentVersion();
        lastFailedAt = Date.now();
        isUpdating = false;
      }
    });
  } catch (err) {
    logger.error(`[AutoUpdate] Check failed: ${err.message}`);
  }
}

/**
 * Start the auto-update polling loop.
 */
function start() {
  if (process.env.DISABLE_AUTO_UPDATE === "true") {
    logger.info("[AutoUpdate] Disabled via DISABLE_AUTO_UPDATE=true");
    return;
  }

  // Require git to be initialized
  if (!fs.existsSync(path.join(ROOT, ".git"))) {
    logger.warn("[AutoUpdate] No .git directory found — auto-update disabled (run setup.sh or git init)");
    return;
  }

  currentVersion = getCurrentVersion();
  logger.info(`[AutoUpdate] Current version: ${currentVersion || "untagged"} — polling every ${POLL_INTERVAL / 1000}s`);

  // Initial check after a short delay (let server finish booting)
  setTimeout(() => checkForUpdate(), 30_000);
  intervalId = setInterval(() => checkForUpdate(), POLL_INTERVAL);
}

/**
 * Stop the auto-update polling loop.
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Check if an update is currently in progress.
 */
function isMaintenanceMode() {
  return fs.existsSync(MAINTENANCE_FLAG);
}

module.exports = { start, stop, isMaintenanceMode, checkForUpdate };
