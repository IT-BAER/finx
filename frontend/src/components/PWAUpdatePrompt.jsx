import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { trackPWAEvent } from "../utils/pwa.js";
/**
 * PWAUpdatePrompt
 *
 * - Shows a non-intrusive bottom install-style prompt when a new SW is waiting.
 * - Matches InstallPrompt visual style and placement (bottom).
 * - Does NOT auto-refresh. Users choose "Update Now" or "Not now".
 * - On "Update Now" clears UI caches, tells SW to skipWaiting, and waits for controllerchange before reloading.
 */

const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          // Listen for updatefound on the registration to find a waiting worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;

            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              // When the new worker is installed and there's already a controller,
              // it means an update is waiting and we should prompt the user.
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaitingWorker(newWorker);
                setShowUpdatePrompt(true);
                trackPWAEvent("sw_update_found");
              }
            });
          });
        })
        .catch(() => {});
    }
  }, []);

  const handleUpdate = async () => {
    if (!waitingWorker) return;

    setShowUpdatePrompt(false);

    const toastId = toast.loading("Preparing update — clearing UI cache...", {
      duration: 10000,
    });

    try {
      // Clear UI caches so new SW can precache fresh UI assets
      if ("caches" in window) {
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
      }

      // Optionally ask SW to preload known UI routes as a best-effort
      // UI preloading removed temporarily
      // Ask waiting worker to skip waiting
      try {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      } catch (err) {
        // fallback to registration
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) {
            try {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            } catch (e) {
              try {
                await reg.update();
              } catch (_) {}
            }
          }
        }
      }

      // Wait for controllerchange then reload
      let reloaded = false;
      const onControllerChange = () => {
        if (reloaded) return;
        reloaded = true;
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
        toast.dismiss(toastId);
        toast.success("App updated — reloading...", { duration: 1500 });
        setTimeout(() => window.location.reload(), 600);
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );

      // fallback timeout if no controllerchange
      setTimeout(() => {
        if (!reloaded) {
          toast.dismiss(toastId);
          toast.success("Applying update — reloading...", { duration: 1500 });
          window.location.reload();
        }
      }, 8000);
    } catch (err) {
      console.error("PWA update failed:", err);
      toast.dismiss(toastId);
      toast.error("Update failed — please refresh the page manually.");
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
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
