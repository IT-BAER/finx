// Realtime updates via SSE with adaptive reconnect and visibility/connectivity awareness
import { getAuthToken } from "../utils/auth.jsx";
import connectivity from "./connectivity.js";
import cache, { removeByPrefix, cacheKeys } from "../utils/cache.js";

class Realtime {
  constructor() {
    this.es = null;
    this.reconnectTimer = null;
    this.backoff = 1000; // start at 1s
    this.maxBackoff = 30000; // 30s cap
    this.started = false;
    this._onVisibility = this._onVisibility.bind(this);
    this._onConnectivity = this._onConnectivity.bind(this);
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisibility);
      window.addEventListener("serverConnectivityChange", this._onConnectivity);
    }
    this._maybeConnect();
  }

  stop() {
    this.started = false;
    document.removeEventListener("visibilitychange", this._onVisibility);
    window.removeEventListener("serverConnectivityChange", this._onConnectivity);
    this._disconnect();
  }

  _onVisibility() {
    if (document.visibilityState === "visible") {
      this._maybeConnect(true);
    } else {
      // Optionally keep connection alive in background; for battery, close when hidden
      this._disconnect();
    }
  }

  _onConnectivity(e) {
    const online = !!(e && e.detail && e.detail.isOnline);
    if (online) {
      this._maybeConnect(true);
    } else {
      this._disconnect();
    }
  }

  _disconnect() {
    if (this.es) {
      try { this.es.close(); } catch {}
      this.es = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  _maybeConnect(resetBackoff = false) {
    if (!this.started) return;
    if (document.visibilityState === "hidden") return;
    if (!connectivity.getOnline()) return;
    const token = getAuthToken();
    if (!token) return;
    if (this.es) return; // already connected
    if (resetBackoff) this.backoff = 1000;

    try {
      const url = `/api/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url, { withCredentials: false });
      this.es = es;
      es.onopen = () => {
        this.backoff = 1000;
      };
      es.onerror = () => {
        this._disconnect();
        this._scheduleReconnect();
      };
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data || "{}");
          this._handleEvent(data);
        } catch (e) {}
      };
    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (!this.started) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(this.maxBackoff, Math.floor(this.backoff * (0.8 + Math.random() * 0.4)));
    this.backoff = Math.min(this.maxBackoff, this.backoff * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._maybeConnect();
    }, delay);
  }

  _handleEvent(msg) {
    if (!msg || !msg.type) return;
    // Dispatch precise UI refreshes
    const t = String(msg.type);
    if (t.startsWith("transaction:") || t.startsWith("recurring:")) {
      // Notify transactions list to refresh first page
      // Invalidate dashboard/report caches so next fetch is fresh
      removeByPrefix(cacheKeys.DASHBOARD_DATA);
      removeByPrefix(cacheKeys.REPORT_DATA);
      removeByPrefix(cacheKeys.PREFETCH_TRANSACTIONS); // Clear prefetched transactions
      window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
    }
    if (t.startsWith("dashboard:") || t.startsWith("transaction:") || t.startsWith("recurring:")) {
      // Let dashboard/reports decide what to refresh
      removeByPrefix(cacheKeys.DASHBOARD_DATA);
      window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
    }
  }
}

const realtime = new Realtime();

// Auto-start
if (typeof window !== "undefined") {
  // wait a tick so auth token is present if user is already logged in
  setTimeout(() => realtime.start(), 500);
  window.__realtime = realtime;
}

export default realtime;
