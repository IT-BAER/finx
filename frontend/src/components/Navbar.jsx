import React, { useState, useEffect, useRef, useId } from "react";
import { useLocation } from "react-router-dom";
import Button from "./Button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { useTheme } from "../contexts/ThemeContext.jsx";
import useOfflineAPI from "../hooks/useOfflineAPI.js";

import { motion, AnimatePresence } from "framer-motion";
import { hapticTap } from "../utils/haptics.js";
import { motionTheme } from "../utils/motionTheme.js";

const Navbar = () => {
  const { user, logout, isDarkMode, toggleDarkMode } = useAuth();
  const { theme, setTheme, dark, toggleDark, themes } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const fabRef = useRef(null);
  const { isOnline } = useOfflineAPI();
  const desktopSwitchId = useId();
  const mobileSwitchId = useId();
  const authPageSwitchId = useId();

  // Check if we're on the login or register page
  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/register";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  // Handle click outside and scroll to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    const handleScroll = () => {
      if (isDropdownOpen) {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, {
        passive: true,
        capture: true,
      });
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("touchmove", handleScroll, {
        passive: true,
        capture: true,
      });
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, { capture: true });
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("touchmove", handleScroll, {
        capture: true,
      });
    };
  }, [isDropdownOpen]);

  // Ensure the floating action button keeps a visible shadow even when a global
  useEffect(() => {
    if (!fabRef || !fabRef.current) return;
    try {
      fabRef.current.style.setProperty(
        "box-shadow",
        "rgba(2, 6, 23, 0.5) 0px 4px 23px, rgba(59, 130, 246, 0.15) 0px 6px 5px"
      );
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 transition-all duration-300 shadow-lg shadow-gray-300/50 dark:shadow-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-gradient">
                FinX
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-2">
                    <NavLink to="/dashboard" icon="/icons/overview.svg">
                      {t("overview")}
                    </NavLink>
                    <NavLink to="/transactions" icon="/icons/transactions.svg">
                      {t("transactions")}
                    </NavLink>

                    <NavLink to="/add-transaction" icon="/icons/edit.svg">
                      {t("addTransaction")}
                    </NavLink>
                    <NavLink
                      to="/reports"
                      icon="/icons/reports.svg"
                      offlineDisabled={!isOnline}
                      offlineIcon="/icons/offline.svg"
                    >
                      {t("reports")}
                    </NavLink>
                  </div>

                  <div className="flex items-center gap-4 ml-2 pl-4 border-l border-gray-200 dark:border-gray-700">
                    <Switch
                      id={desktopSwitchId}
                      checked={!dark}
                      onChange={toggleDark}
                    />

                    <div className="relative" ref={dropdownRef}>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        transition={motionTheme.springs.press}
                        onClick={toggleDropdown}
                        className="flex items-center gap-2 group"
                      >
                        <img
                          src="/icons/user.svg"
                          alt="User"
                          className="w-8 h-8 rounded-full icon-tint-accent"
                        />
                        <span className="hidden lg:inline text-gray-700 dark:text-gray-300 font-medium">
                          Hey, {user.first_name || user.email.split("@")[0]}
                        </span>
                        <svg
                          className="w-4 h-4 ml-2 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </motion.button>
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute right-0 mt-2 w-48 rounded-lg shadow-2xl max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 ring-1 ring-black/5 dark:ring-white/10 py-2 z-50 bg-white/95 dark:bg-gray-800/95 origin-top-right"
                            onMouseLeave={closeDropdown}
                          >
                            <NavDropdownItem
                              to="/settings"
                              icon="/icons/settings.svg"
                              onClick={() => {
                                closeDropdown();
                                if (location.pathname !== "/settings") {
                                  navigate("/settings");
                                }
                              }}
                            >
                              <div className="flex items-center">
                                <span>{t("settings")}</span>
                              </div>
                            </NavDropdownItem>
                            <div className="border-b border-gray-200 dark:border-gray-700 mx-4 my-1"></div>
                            <NavDropdownItem
                              onClick={() => {
                                closeDropdown();
                                handleLogout();
                              }}
                              icon="/icons/logout.svg"
                              danger
                            >
                              {t("logout")}
                            </NavDropdownItem>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              ) : isAuthPage ? (
                <div className="flex items-center gap-4">
                  <Switch
                    id={authPageSwitchId}
                    checked={!dark}
                    onChange={toggleDark}
                  />
                </div>
              ) : (
                <>
                  <motion.div
                    whileTap={{ scale: 0.96 }}
                    transition={motionTheme.springs.press}
                  >
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/login")}
                      className="text-sm"
                    >
                      Login
                    </Button>
                  </motion.div>
                  {import.meta.env.VITE_DISABLE_REGISTRATION !== "true" && (
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      transition={motionTheme.springs.press}
                    >
                      <Button
                        variant="primary"
                        onClick={() => navigate("/register")}
                        className="text-sm"
                      >
                        Register
                      </Button>
                    </motion.div>
                  )}
                  <div className="ml-2">
                    <motion.select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="form-input py-1 pl-2 pr-6 text-sm w-auto max-w-[140px]"
                      aria-label="Theme"
                      title="Theme"
                      whileTap={{ scale: 0.96 }}
                      transition={motionTheme.springs.press}
                    >
                      {themes.map((th) => (
                        <option key={th.key} value={th.key}>
                          {th.label}
                        </option>
                      ))}
                    </motion.select>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-3">
              <Switch
                id={mobileSwitchId}
                checked={!dark}
                onChange={toggleDark}
              />
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    transition={motionTheme.springs.press}
                    onClick={toggleDropdown}
                    className="flex items-center gap-0.5"
                  >
                    <img
                      src="/icons/user.svg"
                      alt="User"
                      className="w-10 h-10 rounded-full icon-tint-accent"
                    />
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      ></path>
                    </svg>
                  </motion.button>
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute right-0 mt-2 w-48 rounded-lg shadow-2xl max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 ring-1 ring-black/5 dark:ring-white/10 py-2 z-50 bg-white/95 dark:bg-gray-800/95"
                        onMouseLeave={closeDropdown}
                      >
                        <NavDropdownItem
                          to="/settings"
                          icon="/icons/settings.svg"
                          onClick={() => {
                            closeDropdown();
                            if (location.pathname !== "/settings")
                              navigate("/settings");
                          }}
                        >
                          <div className="flex items-center">
                            <span>{t("settings")}</span>
                          </div>
                        </NavDropdownItem>
                        <div className="border-b border-gray-200 dark:border-gray-700 mx-4 my-1"></div>
                        <NavDropdownItem
                          onClick={() => {
                            closeDropdown();
                            handleLogout();
                          }}
                          icon="/icons/logout.svg"
                          danger
                        >
                          {t("logout")}
                        </NavDropdownItem>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Menu */}
      {user && (
        <div className="mobile-menu md:hidden mobile-menu-shadow relative">
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 rounded-full"
            initial={false}
            animate={{
              x:
                location.pathname === "/dashboard" || location.pathname === "/"
                  ? "0%"
                  : location.pathname === "/transactions"
                    ? "100%"
                    : location.pathname === "/reports"
                      ? "300%"
                      : location.pathname === "/settings"
                        ? "400%"
                        : "0%",
              opacity: [
                "/",
                "/dashboard",
                "/transactions",
                "/reports",
                "/settings",
              ].includes(location.pathname)
                ? 1
                : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
            }}
            style={{
              width: "20%",
              background: `radial-gradient(60% 200% at 50% 100%, ${
                theme === "ocean"
                  ? "#5cc6ff, #0284c7 60%, #0369a1"
                  : theme === "forest"
                    ? "#4ade80, #16a34a 60%, #15803d"
                    : theme === "rose"
                      ? "#fb7185, #e11d48 60%, #be123c"
                      : "#5cc6ff, #3b82f6 60%, #1d4ed8"
              })`,
              filter: "blur(1px)",
              willChange: "transform, width",
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "inherit",
                filter: "blur(6px)",
                opacity: 0.35,
                transform: "scale(1.2)",
              }}
            ></div>
          </motion.div>

          <div className="grid grid-cols-5">
            <button
              onClick={() => {
                try {
                  window.__finx_navigate_with_animation = true;
                } catch (e) {}
                if (location.pathname !== "/dashboard") navigate("/dashboard");
              }}
              className="mobile-menu-item"
              style={{ color: "inherit" }}
            >
              <img
                src="/icons/overview.svg"
                alt="Overview"
                className="mobile-menu-icon icon-tint-accent"
              />
              <span className="mobile-menu-label">{t("overview")}</span>
            </button>

            <button
              onClick={() => {
                try {
                  window.__finx_navigate_with_animation = true;
                } catch (e) {}
                if (location.pathname !== "/transactions")
                  navigate("/transactions");
              }}
              className="mobile-menu-item"
              style={{ color: "inherit" }}
            >
              <img
                src="/icons/transactions.svg"
                alt="Transactions"
                className="mobile-menu-icon icon-tint-accent"
              />
              <span className="mobile-menu-label">{t("transactions")}</span>
            </button>

              <motion.button
              ref={fabRef}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              transition={motionTheme.springs.press}
              onClick={() => {
                hapticTap(true);
                // If already on the add-transaction page, trigger a programmatic submit event
                if (location.pathname === "/add-transaction") {
                  try {
                    window.dispatchEvent(new CustomEvent("submitAddTransaction"));
                  } catch (e) {
                    // Fallback to simple Event if CustomEvent not supported
                    window.dispatchEvent(new Event("submitAddTransaction"));
                  }
                  return;
                }
                // Otherwise navigate to the add page
                if (location.pathname !== "/add-transaction") {
                  navigate("/add-transaction");
                }
              }}
              className="w-16 h-16 flex items-center justify-center shadow-2xl -mt-12 btn btn-primary mx-auto self-center"
              style={{ borderRadius: "50%", boxShadow: "rgba(2, 6, 23, 0.5) 0px 0px 15px" }}
              aria-label="Add transaction"
              title="Add transaction"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                ></path>
              </svg>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={motionTheme.springs.press}
              onClick={() => {
                try {
                  window.__finx_navigate_with_animation = true;
                } catch (e) {}
                if (isOnline && location.pathname !== "/reports")
                  navigate("/reports");
              }}
              className={`mobile-menu-item ${!isOnline ? "opacity-50 cursor-not-allowed" : ""}`}
              style={{ color: "inherit" }}
              disabled={!isOnline}
              title={!isOnline ? "This feature is not available offline" : ""}
            >
              {isOnline ? (
                <img
                  src="/icons/reports.svg"
                  alt="Reports"
                  className="mobile-menu-icon icon-tint-accent"
                />
              ) : (
                <img
                  src="/icons/offline.svg"
                  alt="Offline"
                  className="mobile-menu-icon icon-tint"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg opacity='0.5'%3E%3Cpath d='M6.50001 18L6.50001 17.9105C6.49991 17.0449 6.49981 16.2512 6.58661 15.6056C6.6822 14.8946 6.90709 14.1432 7.52514 13.5251C8.14319 12.9071 8.89464 12.6822 9.6056 12.5866C10.2512 12.4998 11.0449 12.4999 11.9105 12.5H12.0895C12.9551 12.4999 13.7488 12.4998 14.3944 12.5866C15.1054 12.6822 15.8568 12.9071 16.4749 13.5251C17.0929 14.1432 17.3178 14.8946 17.4134 15.6056C17.4989 16.2417 17.5001 17.0215 17.5 17.8722C20.0726 17.3221 22 15.0599 22 12.3529C22 9.88113 20.393 7.78024 18.1551 7.01498C17.8371 4.19371 15.4159 2 12.4762 2C9.32028 2 6.7619 4.52827 6.7619 7.64706C6.7619 8.33687 6.88706 8.9978 7.11616 9.60887C6.8475 9.55673 6.56983 9.52941 6.28571 9.52941C3.91878 9.52941 2 11.4256 2 13.7647C2 16.1038 3.91878 18 6.28571 18L6.50001 18Z' fill='%231C274C'/%3E%3C/g%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12 22C10.1144 22 9.17157 22 8.58579 21.4142C8 20.8284 8 19.8856 8 18C8 16.1144 8 15.1716 8.58579 14.5858C9.17157 14 10.1144 14 12 14C13.8856 14 14.8284 14 15.4142 14.5858C16 15.1716 16 16.1144 16 18C16 19.8856 16 20.8284 15.4142 21.4142C14.8284 22 13.8856 22 12 22ZM10.6936 15.7508C10.4333 15.4905 10.0112 15.4905 9.75082 15.7508C9.49047 16.0112 9.49047 16.4333 9.75082 16.6936L11.0572 18L9.75082 19.3064C9.49047 19.5667 9.49047 19.9888 9.75082 20.2492C10.0112 20.5095 10.4333 20.5095 10.6936 20.2492L12 18.9428L13.3064 20.2492C13.5667 20.5095 13.9888 20.5095 14.2492 20.2492C14.5095 19.9888 14.5095 19.5667 14.2492 19.3064L12.9428 18L14.2492 16.6936C14.5095 16.4333 14.5095 16.0112 14.2492 15.7508C13.9888 15.4905 13.5667 15.4905 13.3064 15.7508L12 17.0572L10.6936 15.7508Z' fill='%231C274C'/%3E%3C/svg%3E";
                  }}
                />
              )}
              <span className="mobile-menu-label">{t("reports")}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={motionTheme.springs.press}
              onClick={() => {
                try {
                  window.__finx_navigate_with_animation = true;
                } catch (e) {}
                if (location.pathname !== "/settings") navigate("/settings");
              }}
              className="mobile-menu-item"
              style={{ color: "inherit" }}
            >
              <img
                src="/icons/settings.svg"
                alt="Settings"
                className="mobile-menu-icon icon-tint-accent"
              />
              <span className="mobile-menu-label">{t("settings")}</span>
            </motion.button>
          </div>
        </div>
      )}
    </>
  );
};

// Add CSS for dropdown animation
const style = document.createElement("style");
style.textContent = `
  @keyframes dropdownFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes dropdownFadeOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
  
  .dropdown-enter {
    animation: dropdownFadeIn 0.2s ease-out forwards;
  }
  
  .dropdown-exit {
    animation: dropdownFadeOut 0.15s ease-in forwards;
  }
`;
document.head.appendChild(style);

/* Modern NavLink component */
const NavLink = ({
  to,
  icon,
  children,
  offlineDisabled = false,
  offlineIcon,
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  const { isOnline } = useOfflineAPI();

  // If offline disabled and we're offline, render a disabled link
  if (offlineDisabled && !isOnline) {
    return (
      <motion.div
        whileTap={{ scale: 0.96 }}
        transition={motionTheme.springs.press}
      >
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-not-allowed ${
            isActive
              ? "text-blue-400 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/10"
              : "text-gray-400 dark:text-gray-500 bg-gray-100/50 dark:bg-gray-700/30"
          }`}
          title="This feature is not available offline"
        >
          {icon && (
            <img
              src={offlineIcon || "/icons/offline.svg"}
              alt=""
              className="w-5 h-5 opacity-50 dark:opacity-40 dark:brightness-0 dark:invert"
              aria-hidden="true"
              onError={(e) => {
                // Fallback to data URL if icon fails to load (e.g., when offline)
                e.target.src =
                  "data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg opacity='0.5'%3E%3Cpath d='M6.50001 18L6.50001 17.9105C6.49991 17.0449 6.49981 16.2512 6.58661 15.6056C6.6822 14.8946 6.90709 14.1432 7.52514 13.5251C8.14319 12.9071 8.89464 12.6822 9.6056 12.5866C10.2512 12.4998 11.0449 12.4999 11.9105 12.5H12.0895C12.9551 12.4999 13.7488 12.4998 14.3944 12.5866C15.1054 12.6822 15.8568 12.9071 16.4749 13.5251C17.0929 14.1432 17.3178 14.8946 17.4134 15.6056C17.4989 16.2417 17.5001 17.0215 17.5 17.8722C20.0726 17.3221 22 15.0599 22 12.3529C22 9.88113 20.393 7.78024 18.1551 7.01498C17.8371 4.19371 15.4159 2 12.4762 2C9.32028 2 6.7619 4.52827 6.7619 7.64706C6.7619 8.33687 6.88706 8.9978 7.11616 9.60887C6.8475 9.55673 6.56983 9.52941 6.28571 9.52941C3.91878 9.52941 2 11.4256 2 13.7647C2 16.1038 3.91878 18 6.28571 18L6.50001 18Z' fill='%231C274C'/%3E%3C/g%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12 22C10.1144 22 9.17157 22 8.58579 21.4142C8 20.8284 8 19.8856 8 18C8 16.1144 8 15.1716 8.58579 14.5858C9.17157 14 10.1144 14 12 14C13.8856 14 14.8284 14 15.4142 14.5858C16 15.1716 16 16.1144 16 18C16 19.8856 16 20.8284 15.4142 21.4142C14.8284 22 13.8856 22 12 22ZM10.6936 15.7508C10.4333 15.4905 10.0112 15.4905 9.75082 15.7508C9.49047 16.0112 9.49047 16.4333 9.75082 16.6936L11.0572 18L9.75082 19.3064C9.49047 19.5667 9.49047 19.9888 9.75082 20.2492C10.0112 20.5095 10.4333 20.5095 10.6936 20.2492L12 18.9428L13.3064 20.2492C13.5667 20.5095 13.9888 20.5095 14.2492 20.2492C14.5095 19.9888 14.5095 19.5667 14.2492 19.3064L12.9428 18L14.2492 16.6936C14.5095 16.4333 14.5095 16.0112 14.2492 15.7508C13.9888 15.4905 13.5667 15.4905 13.3064 15.7508L12 17.0572L10.6936 15.7508Z' fill='%231C274C'/%3E%3C/svg%3E";
              }}
            />
          )}
          <span className="opacity-70">{children}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      transition={motionTheme.springs.press}
    >
      <Link
        to={to}
        onClick={() => {
          try {
            window.__finx_navigate_with_animation = true;
          } catch (e) {}
        }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
        }`}
      >
        {icon && (
          <img
            src={icon}
            alt=""
            className="w-5 h-5 opacity-80 dark:opacity-90 dark:brightness-0 dark:invert"
            aria-hidden="true"
          />
        )}
        {children}
      </Link>
    </motion.div>
  );
};

/* Dropdown item component */
const NavDropdownItem = ({
  to,
  icon,
  children,
  onClick,
  danger = false,
  disabled = false,
}) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // If disabled, don't execute the onClick handler
    if (disabled) return;
    // When a dropdown item triggers navigation, we want the same tap animation behavior
    try {
      window.__finx_navigate_with_animation = true;
    } catch (err) {}
    if (onClick) {
      onClick(e);
    }
  };

  const content = (
    <motion.div
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={motionTheme.springs.press}
      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/4 after:border-b after:border-gray-200 dark:after:border-gray-700 last:after:border-b-0 ${
        disabled
          ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
          : danger
            ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {icon && (
        <img
          src={icon}
          alt=""
          className={`w-5 h-5 ${disabled ? "opacity-50" : danger ? "opacity-90 dark:opacity-100 dark:brightness-0 dark:invert dark:hue-rotate-[280deg] dark:saturate-150" : "opacity-80 dark:opacity-90 dark:brightness-0 dark:invert"}`}
          aria-hidden="true"
          onError={(e) => {
            // Fallback to data URL if icon fails to load (e.g., when offline)
            e.target.src =
              "data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg opacity='0.5'%3E%3Cpath d='M6.50001 18L6.50001 17.9105C6.49991 17.0449 6.49981 16.2512 6.58661 15.6056C6.6822 14.8946 6.90709 14.1432 7.52514 13.5251C8.14319 12.9071 8.89464 12.6822 9.6056 12.5866C10.2512 12.4998 11.0449 12.4999 11.9105 12.5H12.0895C12.9551 12.4999 13.7488 12.4998 14.3944 12.5866C15.1054 12.6822 15.8568 12.9071 16.4749 13.5251C17.0929 14.1432 17.3178 14.8946 17.4134 15.6056C17.4989 16.2417 17.5001 17.0215 17.5 17.8722C20.0726 17.3221 22 15.0599 22 12.3529C22 9.88113 20.393 7.78024 18.1551 7.01498C17.8371 4.19371 15.4159 2 12.4762 2C9.32028 2 6.7619 4.52827 6.7619 7.64706C6.7619 8.33687 6.88706 8.9978 7.11616 9.60887C6.8475 9.55673 6.56983 9.52941 6.28571 9.52941C3.91878 9.52941 2 11.4256 2 13.7647C2 16.1038 3.91878 18 6.28571 18L6.50001 18Z' fill='%231C274C'/%3E%3C/g%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12 22C10.1144 22 9.17157 22 8.58579 21.4142C8 20.8284 8 19.8856 8 18C8 16.1144 8 15.1716 8.58579 14.5858C9.17157 14 10.1144 14 12 14C13.8856 14 14.8284 14 15.4142 14.5858C16 15.1716 16 16.1144 16 18C16 19.8856 16 20.8284 15.4142 21.4142C14.8284 22 13.8856 22 12 22ZM10.6936 15.7508C10.4333 15.4905 10.0112 15.4905 9.75082 15.7508C9.49047 16.0112 9.49047 16.4333 9.75082 16.6936L11.0572 18L9.75082 19.3064C9.49047 19.5667 9.49047 19.9888 9.75082 20.2492C10.0112 20.5095 10.4333 20.5095 10.6936 20.2492L12 18.9428L13.3064 20.2492C13.5667 20.5095 13.9888 20.5095 14.2492 20.2492C14.5095 19.9888 14.5095 19.5667 14.2492 19.3064L12.9428 18L14.2492 16.6936C14.5095 16.4333 14.5095 16.0112 14.2492 15.7508C13.9888 15.4905 13.5667 15.4905 13.3064 15.7508L12 17.0572L10.6936 15.7508Z' fill='%231C274C'/%3E%3C/svg%3E";
          }}
        />
      )}
      <span>{children}</span>
    </motion.div>
  );

  // If disabled, render a div instead of a link/button
  if (disabled) {
    return (
      <div className="block" title="This feature is not available offline">
        {content}
      </div>
    );
  }

  return to ? (
    <Link to={to} onClick={handleClick} className="block">
      {content}
    </Link>
  ) : (
    <button onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  );
};

/* Custom Dark/Light Mode Switch with Offline Indicator */
const Switch = ({ id, checked, onChange }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center space-x-3">
      {/* Tiny Offline Indicator */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          title="Offline Mode"
        >
          <img
            src="/icons/offline.svg"
            alt="Offline"
            className="w-4 h-4 icon-tint-danger"
            onError={(e) => {
              // Fallback to data URL if icon fails to load (e.g., when offline)
              e.target.src =
                "data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg opacity='0.5'%3E%3Cpath d='M6.50001 18L6.50001 17.9105C6.49991 17.0449 6.49981 16.2512 6.58661 15.6056C6.6822 14.8946 6.90709 14.1432 7.52514 13.5251C8.14319 12.9071 8.89464 12.6822 9.6056 12.5866C10.2512 12.4998 11.0449 12.4999 11.9105 12.5H12.0895C12.9551 12.4999 13.7488 12.4998 14.3944 12.5866C15.1054 12.6822 15.8568 12.9071 16.4749 13.5251C17.0929 14.1432 17.3178 14.8946 17.4134 15.6056C17.4989 16.2417 17.5001 17.0215 17.5 17.8722C20.0726 17.3221 22 15.0599 22 12.3529C22 9.88113 20.393 7.78024 18.1551 7.01498C17.8371 4.19371 15.4159 2 12.4762 2C9.32028 2 6.7619 4.52827 6.7619 7.64706C6.7619 8.33687 6.88706 8.9978 7.11616 9.60887C6.8475 9.55673 6.56983 9.52941 6.28571 9.52941C3.91878 9.52941 2 11.4256 2 13.7647C2 16.1038 3.91878 18 6.28571 18L6.50001 18Z' fill='%231C274C'/%3E%3C/g%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12 22C10.1144 22 9.17157 22 8.58579 21.4142C8 20.8284 8 19.8856 8 18C8 16.1144 8 15.1716 8.58579 14.5858C9.17157 14 10.1144 14 12 14C13.8856 14 14.8284 14 15.4142 14.5858C16 15.1716 16 16.1144 16 18C16 19.8856 16 20.8284 15.4142 21.4142C14.8284 22 13.8856 22 12 22ZM10.6936 15.7508C10.4333 15.4905 10.0112 15.4905 9.75082 15.7508C9.49047 16.0112 9.49047 16.4333 9.75082 16.6936L11.0572 18L9.75082 19.3064C9.49047 19.5667 9.49047 19.9888 9.75082 20.2492C10.0112 20.5095 10.4333 20.5095 10.6936 20.2492L12 18.9428L13.3064 20.2492C13.5667 20.5095 13.9888 20.5095 14.2492 20.2492C14.5095 19.9888 14.5095 19.5667 14.2492 19.3064L12.9428 18L14.2492 16.6936C14.5095 16.4333 14.5095 16.0112 14.2492 15.7508C13.9888 15.4905 13.5667 15.4905 13.3064 15.7508L12 17.0572L10.6936 15.7508Z' fill='%231C274C'/%3E%3C/svg%3E";
            }}
          />
        </motion.div>
      )}

      {/* Custom Dark/Light Toggle */}
      <div className="switch-container">
        <label
          htmlFor={id}
          className="switch"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          <input
            id={id}
            type="checkbox"
            checked={!!checked}
            onChange={(e) => onChange && onChange(e.target.checked)}
          />
          <motion.span
            className="slider"
            whileTap={{ scale: 0.96 }}
            transition={motionTheme.springs.press}
          />
          <span className="decoration" />
        </label>
      </div>
    </div>
  );
};

export default Navbar;
