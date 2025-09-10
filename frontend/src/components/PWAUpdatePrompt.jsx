import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackPWAEvent } from "../utils/pwa.js";
import { tRaw } from "../lib/i18n";

// Prevent showing the update prompt multiple times; also allow snooze across session within a period
let hasShownUpdatePrompt = false;
const SNOOZE_KEY = "pwa_update_snooze_until";
const SNOOZE_MINUTES = 30; // user won't be prompted again for 30 minutes when choosing Not now

function isSnoozed() {
  try {
    const ts = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);
    if (!ts) return false;
    return Date.now() < ts;
  } catch {
    return false;
  }
}

function setSnooze() {
  try {
    const until = Date.now() + SNOOZE_MINUTES * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
  } catch {}
}

const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const updatingRef = useRef(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          // If a worker is already waiting when the app starts, prompt immediately
          if (
            registration.waiting &&
            navigator.serviceWorker.controller &&
            !isSnoozed()
          ) {
            setWaitingWorker(registration.waiting);
            if (!hasShownUpdatePrompt) {
              hasShownUpdatePrompt = true;
              setShowUpdatePrompt(true);
              trackPWAEvent("sw_update_waiting");
            }
          }
          // Listen for updatefound on the registration to find a waiting worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller &&
                !isSnoozed()
              ) {
                setWaitingWorker(newWorker);
                if (!hasShownUpdatePrompt) {
                  hasShownUpdatePrompt = true;
                  setShowUpdatePrompt(true);
                  trackPWAEvent("sw_update_found");
                }
              }
            });
          });
        })
        .catch(() => {});
    }
    // Also react to app-level signal from virtual:pwa-register
    const onPwaUpdate = () => {
      if (!hasShownUpdatePrompt && !isSnoozed()) {
        hasShownUpdatePrompt = true;
        setShowUpdatePrompt(true);
      }
    };
    window.addEventListener("pwa-update-available", onPwaUpdate);
    return () => window.removeEventListener("pwa-update-available", onPwaUpdate);
  }, []);

  const handleUpdate = async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;

    setShowUpdatePrompt(false);

    const toastId = window.toastWithHaptic.loading(
      tRaw("preparingUpdateClearingCache"),
      { duration: 10000, id: "pwa-update" },
    );

    // Install controllerchange listener BEFORE triggering activation to avoid race
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      try {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      } catch {}
      window.toastWithHaptic.dismiss(toastId);
      window.toastWithHaptic.success(tRaw("appUpdatedReloading"), {
        duration: 1500,
        id: "pwa-update-success",
      });
      setTimeout(() => window.location.reload(), 600);
    };
    try {
      try {
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      } catch (err) {
        console.warn("Failed to add controllerchange event listener:", err);
      }

      // Clear UI caches so new SW can precache fresh UI assets
      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          const uiCacheKeywords = [
            "app-shell",
            "static-resources",
            "images-cache",
            "icons-cache",
            "fonts-cache",
            "precache",
            "workbox",
          ];
          const cachesToDelete = cacheNames.filter((name) =>
            uiCacheKeywords.some((k) => name.includes(k)),
          );
          await Promise.all(cachesToDelete.map((name) => caches.delete(name)));
        } catch (err) {
          console.warn("Failed to clear caches:", err);
        }
      }

      // Attempt multiple activation paths for robustness
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch (err) {
            console.warn("Failed to postMessage to waiting worker:", err);
          }
        }
      } catch (err) {
        console.warn("Failed to get service worker registration:", err);
      }

      if (waitingWorker) {
        try { waitingWorker.postMessage({ type: "SKIP_WAITING" }); } catch (err) {
          console.warn("Failed to postMessage to waitingWorker:", err);
        }
      }

      if (typeof window.__pwa_update_sw === "function") {
        try { await window.__pwa_update_sw(); } catch (err) {
          console.warn("Failed to execute PWA update service worker:", err);
        }
      } else {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update();
        } catch (err) {
          console.warn("Failed to update service worker:", err);
        }
      }

      // Removed forced fallback reload; user explicitly requested update, rely on controllerchange.
    } catch (err) {
      console.error("PWA update failed:", err);
      window.toastWithHaptic.dismiss(toastId);
      window.toastWithHaptic.error(tRaw("updateFailedPleaseRefresh"), {
        id: "pwa-update-failed",
      });
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    setSnooze();
    trackPWAEvent("sw_update_dismissed");
  };

  return (
    <AnimatePresence>
      {showUpdatePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[9999] pointer-events-auto"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pointer-events-auto">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <img
                  src="/logos/logo-32.png"
                  alt="FinX"
                  className="w-8 h-8 rounded"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Update Available
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  A new version of FinX is available with improvements and bug
                  fixes.
                </p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-3">
                  <button
                    onClick={handleUpdate}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-sm px-4 py-2.5 rounded-md font-medium transition-colors touch-manipulation cursor-pointer min-h-[44px] flex items-center justify-center"
                    style={{ touchAction: "manipulation" }}
                  >
                    Update Now
                  </button>
                  <button
                    onClick={handleDismiss}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm px-4 py-2.5 rounded-md font-medium transition-colors touch-manipulation cursor-pointer min-h-[44px] flex items-center justify-center"
                    style={{ touchAction: "manipulation" }}
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-2 touch-manipulation cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ touchAction: "manipulation" }}
                aria-label="Close update prompt"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;
