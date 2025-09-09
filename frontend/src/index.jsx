import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { UICacheProvider } from "./contexts/UICacheContext.jsx";

// Service worker update notification logic
function showUpdateNotification(onUpdate, onDismiss) {
  // Simple modal implementation
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.bottom = "32px";
  modal.style.left = "50%";
  modal.style.transform = "translateX(-50%)";
  modal.style.background = "#222";
  modal.style.color = "#fff";
  modal.style.padding = "24px 32px";
  modal.style.borderRadius = "8px";
  modal.style.zIndex = "9999";
  modal.style.boxShadow = "0 2px 16px rgba(0,0,0,0.2)";
  modal.innerHTML = `
    <div style="font-size:1.1em;margin-bottom:12px;">A new update is available.</div>
    <button id="sw-update-btn" style="margin-right:16px;padding:8px 18px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;">Update</button>
    <button id="sw-dismiss-btn" style="padding:8px 18px;background:#888;color:#fff;border:none;border-radius:4px;cursor:pointer;">Not now</button>
  `;
  document.body.appendChild(modal);
  document.getElementById("sw-update-btn").onclick = () => {
    document.body.removeChild(modal);
    onUpdate();
  };
  document.getElementById("sw-dismiss-btn").onclick = () => {
    document.body.removeChild(modal);
    if (onDismiss) onDismiss();
  };
}

// Only register service worker in production builds and when not explicitly disabled
if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener("load", () => {
    // VitePWA outputs /sw.js in production
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Listen for updates
        if (registration.waiting) {
          // Already waiting: show notification
          showUpdateNotification(() => {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New update available
                showUpdateNotification(() => {
                  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                });
              }
            });
          }
        });
        // Listen for waiting via message (for Workbox)
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "NEW_VERSION_AVAILABLE") {
            showUpdateNotification(() => {
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            });
          }
        });
      })
      .catch((err) => {
        // Fail silently in production if registration fails; log for debugging
        console.warn("SW registration failed:", err?.message || err);
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Router>
    <AuthProvider>
      <ThemeProvider>
        <UICacheProvider>
          <App />
        </UICacheProvider>
      </ThemeProvider>
    </AuthProvider>
  </Router>,
);
