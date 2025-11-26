/**
 * PWA Utility Functions
 * Helper functions for PWA functionality
 */

/**
 * Check if the app is running in standalone mode (installed as PWA)
 */
export const isStandalone = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
};

/**
 * Check if the app is installable
 */
export const isInstallable = () => {
  return "serviceWorker" in navigator && "BeforeInstallPromptEvent" in window;
};

/**
 * Check if the device is mobile
 */
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

/**
 * Check if the device is iOS
 */
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Check if the device is Android
 */
export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Get PWA display mode
 */
export const getDisplayMode = () => {
  if (isStandalone()) return "standalone";
  if (window.matchMedia("(display-mode: minimal-ui)").matches)
    return "minimal-ui";
  if (window.matchMedia("(display-mode: fullscreen)").matches)
    return "fullscreen";
  return "browser";
};

/**
 * Check if app supports installation
 */
export const supportsInstallation = () => {
  // iOS Safari doesn't support beforeinstallprompt but supports Add to Home Screen
  if (isIOS()) return true;

  // Android and desktop browsers
  return "serviceWorker" in navigator;
};

/**
 * Get installation instructions based on device
 */
export const getInstallInstructions = () => {
  if (isIOS()) {
    return {
      title: "Install on iOS",
      steps: [
        "Tap the Share button",
        'Select "Add to Home Screen"',
        'Tap "Add" to confirm',
      ],
    };
  }

  if (isAndroid()) {
    return {
      title: "Install on Android",
      steps: [
        "Tap the menu (⋮)",
        'Select "Add to Home Screen" or "Install App"',
        'Tap "Install" to confirm',
      ],
    };
  }

  return {
    title: "Install on Desktop",
    steps: [
      "Look for the install icon in the address bar",
      'Click "Install FinX" when prompted',
      "The app will be added to your desktop",
    ],
  };
};

/**
 * Track PWA events for analytics
 */
export const trackPWAEvent = (eventName, properties = {}) => {
  // Add your analytics tracking here
  console.log("PWA Event:", eventName, properties);

  // Example: Google Analytics 4
  if (typeof gtag !== "undefined") {
    gtag("event", eventName, {
      event_category: "PWA",
      ...properties,
    });
  }
};

/**
 * Check if service worker is supported and registered
 */
export const isServiceWorkerSupported = () => {
  return "serviceWorker" in navigator;
};

/**
 * Get service worker registration status
 */
export const getServiceWorkerStatus = async () => {
  if (!isServiceWorkerSupported()) {
    return { supported: false, registered: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      supported: true,
      registered: !!registration,
      active: !!(registration && registration.active),
      waiting: !!(registration && registration.waiting),
      installing: !!(registration && registration.installing),
    };
  } catch (error) {
    return { supported: true, registered: false, error: error.message };
  }
};

/**
 * Force service worker update
 */
export const updateServiceWorker = async () => {
  if (!isServiceWorkerSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      return true;
    }
  } catch (error) {
    console.error("Service worker update failed:", error);
  }

  return false;
};

/**
 * Clear all caches (useful for debugging)
 */
export const clearAllCaches = async () => {
  if (!("caches" in window)) return false;

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    return true;
  } catch (error) {
    console.error("Cache clearing failed:", error);
    return false;
  }
};

import { getIsOnline } from "../services/connectivity.js";

/**
 * Get app info for PWA
 */

export const getAppInfo = () => {
  return {
    name: "FinX",
  version: "0.7.0",
    isStandalone: isStandalone(),
    displayMode: getDisplayMode(),
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  online: typeof window !== "undefined" ? getIsOnline() : true,
    serviceWorkerSupported: isServiceWorkerSupported(),
  };
};

/**
 * Show native share dialog if available
 */
export const shareApp = async (data = {}) => {
  const shareData = {
    title: "FinX - Personal Finance Tracker",
    text: "Check out FinX, a modern personal finance tracking app!",
    url: window.location.origin,
    ...data,
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      trackPWAEvent("app_shared", { method: "native" });
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Share failed:", error);
      }
    }
  }

  // Fallback to copying URL
  try {
    await navigator.clipboard.writeText(shareData.url);
    trackPWAEvent("app_shared", { method: "clipboard" });
    return true;
  } catch (error) {
    console.error("Clipboard write failed:", error);
  }

  return false;
};
