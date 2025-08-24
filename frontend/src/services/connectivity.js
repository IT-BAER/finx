// Connectivity Service: monitors backend reachability and emits events
// Modern PWA best practice: consider app online only when server is reachable

const HEALTH_URL = "/api/health";
// Allow tuning via env (vite) while providing sensible fast defaults
const ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const DEFAULT_INTERVAL_MS = Number(ENV.VITE_CONN_DEFAULT_MS) || 8000; // from 15s -> 8s
const SHORT_RETRY_MS = Number(ENV.VITE_CONN_SHORT_RETRY_MS) || 2000; // from 5s -> 2s
const OFFLINE_RETRY_MS = Number(ENV.VITE_CONN_OFFLINE_RETRY_MS) || 3000; // poll a bit faster while offline
const FAILURE_THRESHOLD = Number(ENV.VITE_CONN_FAILURE_THRESHOLD) || 2; // from 3 -> 2
const TIMEOUT_MS = Number(ENV.VITE_CONN_TIMEOUT_MS) || 2500; // from 4s -> 2.5s

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
    this._nextDelay = this._nextDelay.bind(this);

    // Listen to browser online/offline to trigger immediate check
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.checkNow());
      window.addEventListener("offline", () => this._setOffline("browser-offline"));
      // Also react on focus/visibility to speed up perceived recovery/downgrade
      const onFocus = () => this.checkNow();
      window.addEventListener("focus", onFocus);
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") this.checkNow();
        });
      }
    }
  }

  async _fetchHealth() {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), TIMEOUT_MS); // tightened timeout
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

  _jitter(ms) {
    // add +/-20% jitter to avoid thundering herd
    const factor = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
    return Math.max(250, Math.round(ms * factor));
  }

  _nextDelay() {
    return this._jitter(this.intervalMs);
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
    // While offline, keep checking a bit faster for recovery
    this.intervalMs = OFFLINE_RETRY_MS;
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
    this.timer = setTimeout(this._tick, this._nextDelay());
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
  // nothing else to stop; next call to start/checkNow will resume
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
