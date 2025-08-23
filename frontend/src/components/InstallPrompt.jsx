import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isStandalone, trackPWAEvent } from "../utils/pwa.js";

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show prompt after a delay to not be intrusive
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      trackPWAEvent("install_prompt_result", { outcome });

      if (outcome === "accepted") {
        setShowPrompt(false);
        trackPWAEvent("app_install_accepted");

        // UI preloading removed temporarily
      } else {
        trackPWAEvent("app_install_dismissed");
      }
    } catch (error) {
      console.error("Install prompt failed:", error);
      trackPWAEvent("install_prompt_error", { error: error.message });
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem("installPromptDismissed", "true");
  };

  // Don't show if already installed or dismissed this session
  if (isInstalled || sessionStorage.getItem("installPromptDismissed")) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
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
                  Install FinX
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Install FinX for quick access and offline functionality
                </p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-3">
                  <button
                    onClick={handleInstallClick}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-sm px-4 py-2.5 rounded-md font-medium transition-colors touch-manipulation cursor-pointer min-h-[44px] flex items-center justify-center"
                    style={{ touchAction: "manipulation" }}
                  >
                    Install
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
                aria-label="Close install prompt"
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

export default InstallPrompt;
