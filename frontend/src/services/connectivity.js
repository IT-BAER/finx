// Connectivity Service: monitors backend reachability and emits events
// Modern PWA best practice: consider app online only when server is reachable

const HEALTH_URL = "/api/health";
const DEFAULT_INTERVAL_MS = 15000; // 15s between checks
const SHORT_RETRY_MS = 5000; // after a failure, quicker follow-ups
const FAILURE_THRESHOLD = 3; // switch offline after N consecutive failures
const CONTROLLER = new AbortController();

class Connectivity {
  constructor() {
    this.isServerOnline = true; // optimistic start until proven otherwise
    this.consecutiveFailures = 0;
    this.timer = null;
    this.intervalMs = DEFAULT_INTERVAL_MS;

    // Bind handlers
    this._tick = this._tick.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.checkNow = this.checkNow.bind(this);

    // Listen to browser online/offline to trigger immediate check
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.checkNow());
      window.addEventListener("offline", () => this._setOffline("browser-offline"));
    }
  }

  async _fetchHealth() {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000); // 4s timeout
      const res = await fetch(HEALTH_URL, {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`status ${res.status}`);
      // Ensure not served by SW cache; ignore cached by checking headers if available
      return true;
    } catch (e) {
      return false;
    }
  }

  _emit(status) {
    try {
      const detail = { isOnline: status, consecutiveFailures: this.consecutiveFailures };
      window.dispatchEvent(new CustomEvent("serverConnectivityChange", { detail }));
    } catch {}
  }

  _setOnline() {
    if (!this.isServerOnline) {
      this.isServerOnline = true;
      this.consecutiveFailures = 0;
      this.intervalMs = DEFAULT_INTERVAL_MS;
      this._emit(true);
    } else {
      // Reset failure counter even if already online
      this.consecutiveFailures = 0;
      this.intervalMs = DEFAULT_INTERVAL_MS;
    }
  }

  _setOffline(reason = "health-fail") {
    if (this.isServerOnline) {
      this.isServerOnline = false;
      this._emit(false);
    }
  }

  async _tick() {
    const ok = await this._fetchHealth();
    if (ok) {
      this._setOnline();
    } else {
      this.consecutiveFailures += 1;
      this.intervalMs = SHORT_RETRY_MS;
      if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
        this._setOffline();
      }
    }
    // schedule next
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this._tick, this.intervalMs);
  }

  start() {
    if (this.timer) return;
    // immediate check
    this._tick();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try { CONTROLLER.abort(); } catch {}
  }

  async checkNow() {
    // manual check and immediate reschedule
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this._tick();
  }

  getOnline() {
    return this.isServerOnline;
  }
}

// Singleton
const connectivity = new Connectivity();

// Auto-start when loaded in browser context
if (typeof window !== "undefined") {
  connectivity.start();
  // Expose for debugging
  window.__connectivity = connectivity;
}

export default connectivity;
export const getIsOnline = () => connectivity.getOnline();
