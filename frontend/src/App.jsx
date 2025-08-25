import React from "react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  createContext,
} from "react";
import { registerSW } from "virtual:pwa-register";
import { LanguageProvider } from "./contexts/LanguageContext";
import { SharingProvider } from "./contexts/SharingContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AmbientBackground from "./components/AmbientBackground";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt.jsx";
import { lazy, Suspense } from "react";

// Lazy load swipeable routes for better performance
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Transactions = lazy(() => import("./pages/Transactions.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));

// Preload function for warming up the route chunks
const preloadRoute = (importFunc) => {
  importFunc().catch((err) => {
    console.warn("Failed to preload route:", err);
  });
};

// Lazy load non-swipeable routes as well
const AddTransaction = lazy(() => import("./pages/AddTransaction.jsx"));
const EditTransaction = lazy(() => import("./pages/EditTransaction.jsx"));
const ShareData = lazy(() => import("./pages/ShareData.jsx"));
const EditSharing = lazy(() => import("./pages/EditSharing.jsx"));
const UserManagement = lazy(() => import("./pages/UserManagement.jsx"));
const AdminTaxonomy = lazy(() => import("./pages/AdminTaxonomy.jsx"));
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { hapticTap } from "./utils/haptics.js";

import "./styles/App.css";
import "./styles/CustomSwitch.css";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Custom toast function with haptic feedback
const toastWithHaptic = {
  success: (message, options) => {
    hapticTap(false); // Light haptic feedback for notifications (avoid browser vibration intervention)
    return toast.success(message, options);
  },
  error: (message, options) => {
    hapticTap(false); // Light haptic feedback for notifications (avoid browser vibration intervention)
    return toast.error(message, options);
  },
  info: (message, options) => {
    hapticTap(false); // Light haptic for info notifications
    return toast(message, { ...options, icon: "ℹ️" });
  },
  loading: (message, options) => {
    return toast.loading(message, options);
  },
  promise: (promise, options) => {
    return toast.promise(promise, options);
  },
  dismiss: (toastId) => {
    return toast.dismiss(toastId);
  },
  remove: (toastId) => {
    return toast.remove(toastId);
  },
};

// Make toastWithHaptic globally available
window.toastWithHaptic = toastWithHaptic;

// Define the swipeable routes for mobile navigation
const SWIPEABLE_ROUTES = [
  { path: "/dashboard", component: Dashboard },
  { path: "/transactions", component: Transactions },
  { path: "/reports", component: Reports },
  { path: "/settings", component: Settings },
];

// Check if device is mobile
const isMobile = () => {
  return typeof window !== "undefined" && window.innerWidth <= 768;
};

// Defer loading the heavy gesture/spring code until it's actually needed.
// SwipeableRoutesInner contains the react-spring / react-use-gesture logic and is only imported on mobile swipe routes.
const SwipeableRoutesInner = React.lazy(
  () => import("./components/SwipeableRoutesInner.jsx"),
);

// Lightweight wrapper that lazy-loads the heavy gesture/spring code only when needed.
function SwipeableRoutes() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      }
    >
      <SwipeableRoutesInner />
    </React.Suspense>
  );
}

// App loading context
const AppLoadingContext = createContext({
  isAppReady: false,
  pageContentReady: false,
  setAppReady: () => {},
  setPageContentReady: () => {},
});

function ComponentWrapper({ Component }) {
  const [isComponentReady, setIsComponentReady] = useState(false);
  const [containerHeight, setContainerHeight] = useState("auto");
  const componentRef = useRef(null);
  const { setPageContentReady } = useContext(AppLoadingContext);
  const location = useLocation();

  // For the login page, avoid forcing a large min-height so the layout feels lighter
  const disableMinHeight = location.pathname === "/login";

  useEffect(() => {
    // Component is ready after a short delay
    const timer = setTimeout(() => {
      setIsComponentReady(true);
      updateHeight();
      // Notify app that page content is ready
      setPageContentReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [setPageContentReady]);

  // Update height based on content
  const updateHeight = () => {
    if (componentRef.current) {
      const height = componentRef.current.scrollHeight;
      const minHeight = Math.max(height, window.innerHeight - 140); // More precise navbar/footer calculation
      setContainerHeight(`${minHeight}px`);
    }
  };

  // Set up window resize listener (debounced with rAF) to update height
  useEffect(() => {
    if (!componentRef.current) return;
    let scheduled = false;
    const onResize = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        updateHeight();
        scheduled = false;
      });
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [isComponentReady]);

  // Reset page content ready state when component changes
  useEffect(() => {
    setPageContentReady(true);
  }, [Component, setPageContentReady]);

  return (
    <div
      ref={componentRef}
      style={{
        opacity: isComponentReady ? 1 : 0,
        transition: "opacity 0.3s ease-in-out, transform 0.3s ease-out",
        transform: isComponentReady ? "translateY(0)" : "translateY(10px)",
  transitionProperty: "opacity, transform",
  // Remove min-height on login to prevent overly tall containers
  minHeight: disableMinHeight ? undefined : containerHeight,
        paddingTop: "1rem",
      }}
    >
      <Component />
    </div>
  );
}

function App() {
  const location = useLocation();
  const isSwipeableRoute = SWIPEABLE_ROUTES.some(
    (route) => route.path === location.pathname,
  );
  const isMobileDevice = isMobile();

  useEffect(() => {
    const routeImports = {
      "/dashboard": () => import("./pages/Dashboard.jsx"),
      "/transactions": () => import("./pages/Transactions.jsx"),
      "/reports": () => import("./pages/Reports.jsx"),
      "/settings": () => import("./pages/Settings.jsx"),
    };

    const scheduleIdle = (fn) => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(fn, { timeout: 2000 });
      } else {
        setTimeout(fn, 1500);
      }
    };

    SWIPEABLE_ROUTES.forEach((route) => {
      const importFunc = routeImports[route.path];
      if (importFunc) {
        // Defer heavy route chunk preload to idle time to avoid blocking initial rendering/scroll
        scheduleIdle(() => preloadRoute(importFunc));
      }
    });
  }, []);

  const [isAppReady, setIsAppReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [pageContentReady, setPageContentReady] = useState(false);
  // Track server connectivity instead of device online
  useEffect(() => {
    const handler = (e) => {
      // Could set local state if App UI needs it later
      // const nowOnline = !!(e && e.detail && e.detail.isOnline);
    };
    window.addEventListener("serverConnectivityChange", handler);
    return () => window.removeEventListener("serverConnectivityChange", handler);
  }, []);

  // Register service worker without periodic auto-update; updates are user-driven via prompt
  useEffect(() => {
    registerSW();
  }, []);

  // Handle app ready state
  useEffect(() => {
    // Wait for initial render
    const initialTimer = setTimeout(() => {
      setShowContent(true);
    }, 100);

    return () => {
      clearTimeout(initialTimer);
    };
  }, []);

  // Show footer only when page content is ready
  useEffect(() => {
    if (pageContentReady) {
      const footerTimer = setTimeout(() => {
        setIsAppReady(true);
      }, 200);

      return () => clearTimeout(footerTimer);
    }
  }, [pageContentReady]);

  return (
    <LanguageProvider>
      <SharingProvider>
        <ThemeProvider>
          <AppLoadingContext.Provider
            value={{
              isAppReady,
              pageContentReady,
              setAppReady: setIsAppReady,
              setPageContentReady,
            }}
          >
            <AmbientBackground />
            <div className="App">
              <div
                style={{
                  opacity: showContent ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out",
                }}
              >
                <Navbar />
              </div>
              <Toaster
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  },
                  success: {
                    style: {
                      background:
                        "color-mix(in srgb, var(--success) 15%, var(--surface))",
                      border: "1px solid var(--success)",
                    },
                    iconTheme: {
                      primary: "var(--success)",
                      secondary: "var(--surface)",
                    },
                  },
                  error: {
                    style: {
                      background:
                        "color-mix(in srgb, var(--danger) 15%, var(--surface))",
                      border: "1px solid var(--danger)",
                    },
                    iconTheme: {
                      primary: "var(--danger)",
                      secondary: "var(--surface)",
                    },
                  },
                }}
              />
              <ScrollToTop />
              <div
                style={{
                  opacity: showContent ? 1 : 0,
                  transition: "opacity 0.5s ease-in-out 0.1s",
                  flex: 1,
                }}
              >
                {isSwipeableRoute && isMobileDevice ? (
                  <SwipeableRoutes />
                ) : (
                  <div className="main-content flex flex-col flex-1">
                    <Routes>
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="/login"
                        element={
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center h-full">
                                <div className="spinner"></div>
                              </div>
                            }
                          >
                            <ComponentWrapper Component={Login} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/register"
                        element={
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center h-full">
                                <div className="spinner"></div>
                              </div>
                            }
                          >
                            <ComponentWrapper Component={Register} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={Dashboard} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/transactions"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={Transactions} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/add-transaction"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={AddTransaction} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/edit-transaction/:id"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={EditTransaction} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <ProtectedRoute offlineDisabled>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={Reports} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute offlineDisabled>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={Settings} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/share-data"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={ShareData} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/edit-sharing/:id"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={EditSharing} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/user-management"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={UserManagement} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin-taxonomy"
                        element={
                          <ProtectedRoute>
                            <Suspense
                              fallback={
                                <div className="flex items-center justify-center h-full">
                                  <div className="spinner"></div>
                                </div>
                              }
                            >
                              <ComponentWrapper Component={AdminTaxonomy} />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </div>
                )}
              </div>
              <div
                style={{
                  opacity: 1,
                  transition: "opacity 0.4s ease-in-out",
                  animation: "fadeInUp 0.4s ease-out",
                }}
              >
                <Footer />
              </div>

              {/* PWA Components */}
              <InstallPrompt />
              <PWAUpdatePrompt />
            </div>
          </AppLoadingContext.Provider>
        </ThemeProvider>
      </SharingProvider>
    </LanguageProvider>
  );
}

export default App;
