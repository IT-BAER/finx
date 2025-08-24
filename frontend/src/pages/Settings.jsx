import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTranslation } from "../hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { useSharing } from "../contexts/SharingContext";
import { useTheme } from "../contexts/ThemeContext.jsx";

import Button from "../components/Button";
import Dropdown from "../components/Dropdown";
import Input from "../components/Input";
import { motion } from "framer-motion";
import { motionTheme } from "../utils/motionTheme.js";
import Import from "../components/Import.jsx";
import Export from "../components/Export.jsx";
import Modal from "../components/Modal.jsx";
import Icon from "../components/Icon.jsx";

const Settings = () => {
  const { isIncomeTrackingDisabled, toggleIncomeTracking, user, refreshUser } =
    useAuth();
  const { language, changeLanguage } = useLanguage();
  const { theme, setTheme, themes, dark, toggleDark } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { myPermissions, sharedWithMe, fetchMyPermissions, fetchSharedWithMe } =
    useSharing();
  const [profileData, setProfileData] = useState({
    email: user?.email || "",
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showRemoveSampleDataModal, setShowRemoveSampleDataModal] =
    useState(false);
  const isCurrentPage = useRef(true);

  useEffect(() => {
    if (user) {
      setProfileData({
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      });
    }
    // fetchMyPermissions();
    // fetchSharedWithMe();

    // Set up visibility change listener for background data refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isCurrentPage.current) {
        // Refresh data when page becomes visible
        refreshSettingsData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  // Function to refresh data in the background
  const refreshSettingsData = async () => {
    try {
      // Refresh user data
      const updatedUser = await refreshUser();
      if (updatedUser) {
        setProfileData({
          email: updatedUser.email || "",
          first_name: updatedUser.first_name || "",
          last_name: updatedUser.last_name || "",
        });
      }

      // Refresh sharing data
      await Promise.all([fetchMyPermissions(), fetchSharedWithMe()]);

      // Show a subtle notification if data was updated
      console.log("Settings data refreshed in background");
    } catch (err) {
      console.error("Error refreshing settings data:", err);
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    changeLanguage(newLanguage);
    window.toastWithHaptic.success(t("languageChanged"));
  };

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
  email: profileData.email,
      };
      await (await import("../services/api.jsx")).authAPI.updateUser(payload);

      const updated = await refreshUser();
      if (updated) {
        setProfileData({
          email: updated.email || "",
          first_name: updated.first_name || "",
          last_name: updated.last_name || "",
        });
      }

      window.toastWithHaptic.success(t("profileUpdated"));
    } catch (err) {
      console.error("Failed to update profile:", err);
      window.toastWithHaptic.error(
        err.response?.data?.message ||
          t("failedToUpdateProfile") ||
          "Failed to update profile",
      );
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      window.toastWithHaptic.error(t("passwordsDoNotMatch"));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      window.toastWithHaptic.error(t("passwordMinLength"));
      return;
    }

    try {
      const { authAPI } = await import("../services/api.jsx");
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      window.toastWithHaptic.success(t("passwordUpdated"));
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error("Failed to update password:", err);
      window.toastWithHaptic.error(
        err.response?.data?.message ||
          t("failedToUpdatePassword") ||
          "Failed to update password",
      );
    }
  };

  const { logout } = useAuth();

  const handleDeleteAccount = async () => {
    try {
      await (await import("../services/api.jsx")).authAPI.deleteAccount();
      await logout();
      navigate("/login");
    } catch (err) {
      window.toastWithHaptic.error(t("failedToDeleteAccount"));
      console.error("Account deletion failed:", err);
    } finally {
      setShowDeleteAccountModal(false);
    }
  };

  const [showExport, setShowExport] = useState(false);

  const handleExportData = () => {
    setShowExport(true);
  };

  const [showImport, setShowImport] = useState(false);

  const handleImportData = () => {
    setShowImport(true);
  };

  const handleRemoveSampleData = async () => {
    try {
      const { adminAPI } = await import("../services/api.jsx");
      await adminAPI.removeSampleData();
      window.toastWithHaptic.success(
        t("sampleDataRemoved") || "Sample data successfully removed",
      );
    } catch (err) {
      console.error("Sample data removal failed:", err);
      window.toastWithHaptic.error(
        t("failedToRemoveSampleData") || "Failed to remove sample data",
      );
    } finally {
      setShowRemoveSampleDataModal(false);
    }
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 min-h-0">
      <h1 className="display-2 mb-8">{t("settingsTitle")}</h1>

      <Modal
        show={showImport}
        onClose={() => setShowImport(false)}
        title={t("importData")}
      >
        <Import onClose={() => setShowImport(false)} />
      </Modal>

      {showExport && <Export />}

      <Modal
        show={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        title={t("pleaseConfirm")}
        onConfirm={handleDeleteAccount}
        confirmText={t("deleteAccount")}
      >
        <p>{t("areYouSureYouWantToDeleteYourAccount")}</p>
      </Modal>

      <Modal
        show={showRemoveSampleDataModal}
        onClose={() => setShowRemoveSampleDataModal(false)}
        title={t("pleaseConfirm")}
        onConfirm={handleRemoveSampleData}
        confirmText={t("removeSampleData")}
      >
        <p>{t("areYouSureYouWantToRemoveSampleData")}</p>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card lg:col-span-1">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-6">{t("general")}</h2>

            <div
              className={`flex items-center justify-between p-4 rounded-lg mb-4 ${
                dark ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center flex-1">
                <div className="mr-3">
                  <span className="icon-wrap icon-wrap-md icon-wrap-circle">
                    <Icon
                      src={
                        dark ? "/icons/dark-mode.svg" : "/icons/light-mode.svg"
                      }
                      size="md"
                      variant="accent"
                    />
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium">{t("design") || "Design"}</span>
                </div>
              </div>
              <div style={{ width: "10rem" }}>
                <Dropdown
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  options={themes.map((th) => ({
                    value: th.key,
                    label: th.label,
                  }))}
                  placeholder="Select theme"
                />
              </div>
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-lg ${
                dark ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center">
                <div className="mr-3">
                  <span className="icon-wrap icon-wrap-md icon-wrap-circle">
                    <Icon
                      src="/icons/language.svg"
                      size="md"
                      variant="accent"
                    />
                  </span>
                </div>
                <span className="font-medium">{t("language")}</span>
              </div>
              <div style={{ width: "10rem" }}>
                <Dropdown
                  value={language}
                  onChange={handleLanguageChange}
                  options={[
                    { value: "en", label: t("english") },
                    { value: "de", label: t("german") },
                  ]}
                  placeholder="Select language"
                />
              </div>
            </div>

            <div
              className={`flex items-start justify-between p-4 rounded-lg mt-4 ${
                dark ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex items-start flex-1 min-w-0">
                <div className="mr-3 mt-0.5 flex-shrink-0">
                  <span className="icon-wrap icon-wrap-md icon-wrap-circle">
                    <Icon
                      src="/icons/currency-euro.svg"
                      size="md"
                      variant="accent"
                    />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{t("incomeTracking")}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                    {t("incomeTrackingDescription")}
                  </div>
                </div>
              </div>
              <motion.button
                onClick={toggleIncomeTracking}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
                  isIncomeTrackingDisabled ? "bg-gray-300" : "bg-blue-600"
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={motionTheme.springs.press}
              >
                <motion.span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    isIncomeTrackingDisabled ? "translate-x-1" : "translate-x-6"
                  }`}
                  animate={{
                    x: isIncomeTrackingDisabled ? 4 : 24,
                  }}
                  transition={motionTheme.springs.press}
                />
              </motion.button>
            </div>

            <div
              className={`p-4 rounded-lg mt-4 ${
                dark ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center mb-4">
                <div className="mr-3">
                  <span className="icon-wrap icon-wrap-md icon-wrap-circle">
                    <Icon src="/icons/share.svg" size="md" variant="accent" />
                  </span>
                </div>
                <span className="font-medium">{t("dataSharing")}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg bg-white/80 dark:bg-gray-800/70 shadow-soft p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    {t("sharedWithOthers")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {myPermissions.length}
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 dark:bg-gray-800/70 shadow-soft p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    {t("sharedWithMe")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {sharedWithMe.length}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-center md:justify-end">
                <Button
                  type="button"
                  onClick={() => navigate("/share-data")}
                  variant="primary"
                  size="sm"
                >
                  {t("editShares")}
                </Button>
              </div>
            </div>

            {/* Account Actions Section */}
            <div
              className={`p-4 rounded-lg mt-4 ${
                dark ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex flex-col space-y-4">
                {/* Title Row */}
                <div className="flex items-center">
                  <div className="mr-3">
                    <span className="icon-wrap icon-wrap-md icon-wrap-circle">
                      <Icon
                        src="/icons/settings.svg"
                        size="md"
                        variant="accent"
                      />
                    </span>
                  </div>
                  <span className="font-medium">{t("accountActions")}</span>
                </div>

                {/* Buttons Row */}
                <div className="flex flex-col items-center sm:flex-row sm:justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleImportData}
                    icon={
                      <Icon
                        src="/icons/import.svg"
                        size="md"
                        variant="accent"
                      />
                    }
                    className="w-full sm:w-auto text-sm"
                    haptic="tap"
                  >
                    {t("importData")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleExportData}
                    icon={
                      <Icon
                        src="/icons/export.svg"
                        size="md"
                        variant="accent"
                      />
                    }
                    className="w-full sm:w-auto text-sm"
                    haptic="tap"
                  >
                    {t("exportData")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteAccountModal(true)}
                    icon={
                      <Icon
                        src="/icons/trash.svg"
                        size="md"
                        variant="danger"
                        className="icon-md"
                        alt={t("deleteAccount")}
                      />
                    }
                    className="w-full sm:w-auto text-sm"
                    haptic="heavy"
                  >
                    {t("deleteAccount")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-1">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-6">
              {t("profileSettings")}
            </h2>

            <form onSubmit={handleProfileSubmit} className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="form-group">
                  <Input
                    type="text"
                    id="first_name"
                    name="first_name"
                    label={t("firstName")}
                    value={profileData.first_name}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <Input
                    type="text"
                    id="last_name"
                    name="last_name"
                    label={t("lastName")}
                    value={profileData.last_name}
                    onChange={handleProfileChange}
                  />
                </div>
              </div>

              <div className="form-group mb-6">
                <Input
                  type="email"
                  id="email"
                  name="email"
                  label={t("email")}
                  value={profileData.email}
                  onChange={handleProfileChange}
                  required
                />
              </div>

              <div className="flex justify-center md:justify-end">
                <Button variant="primary" type="submit" haptic="impact">
                  {t("updateProfile")}
                </Button>
              </div>
            </form>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-6">
                {t("changePassword")}
              </h3>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  type="email"
                  value={profileData.email}
                  readOnly
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="username"
                />
                <div className="form-group">
                  <Input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    label={t("currentPassword")}
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <div className="form-group">
                  <Input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    label={t("newPassword")}
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <Input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    label={t("confirmNewPassword")}
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex justify-center md:justify-end">
                  <Button variant="primary" type="submit" haptic="impact">
                    {t("changePassword")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Removed Account Actions card - now integrated into main settings card */}

      {user && user.is_admin && (
        <div className="card mt-8">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-6">
              {t("adminSettings") || "Admin Settings"}
            </h2>

            <div className="grid grid-cols-3 w-full gap-4 max-[800px]:grid-cols-2 max-[500px]:grid-cols-1">
              <motion.div
                className={`group w-full rounded-lg p-5 transition relative duration-300 cursor-pointer 
                  hover:translate-y-[3px] opacity-80 hover:opacity-100 ${
                    dark
                      ? "bg-gray-800 hover:shadow-[0_-8px_0px_0px_#546e7a]"
                      : "bg-gray-100 hover:shadow-[0_-8px_0px_0px_#d1d5db]"
                  }`}
                onClick={() => {
                  // Remove haptic feedback - only notifications and "+" button should have haptic
                  navigate("/user-management");
                }}
                whileTap={{ scale: 0.95 }}
                transition={motionTheme.springs.press}
              >
                <p
                  className={`text-lg font-bold ${
                    dark ? "text-gray-100" : "text-gray-800"
                  }`}
                >
                  {t("userManagement")}
                </p>
                <p
                  className={`text-sm mt-1.5 max-w-[75%] ${
                    dark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {t("manageUsersDescription")}
                </p>
                <motion.span
                  className="group-hover:opacity-100 absolute right-[10%] top-[50%] translate-y-[-50%] opacity-80 transition group-hover:scale-110 duration-300 h-10 w-10 shadow-soft"
                  transition={motionTheme.springs.hover}
                >
                  <Icon
                    src="/icons/admin-user.svg"
                    size="lg"
                    variant="accent"
                    className="h-10 w-10 shadow-soft"
                  />
                </motion.span>
              </motion.div>

              <motion.div
                className={`group w-full rounded-lg p-5 transition relative duration-300 cursor-pointer 
                  hover:translate-y-[3px] opacity-80 hover:opacity-100 ${
                    dark
                      ? "bg-gray-800 hover:shadow-[0_-8px_0px_0px_#546e7a]"
                      : "bg-gray-100 hover:shadow-[0_-8px_0px_0px_#d1d5db]"
                  }`}
                onClick={() => {
                  // Remove haptic feedback - only notifications and "+" button should have haptic
                  navigate("/admin-taxonomy");
                }}
                whileTap={{ scale: 0.95 }}
                transition={motionTheme.springs.press}
              >
                <p
                  className={`text-lg font-bold ${
                    dark ? "text-gray-100" : "text-gray-800"
                  }`}
                >
                  {t("adminTaxonomy")}
                </p>
                <p
                  className={`text-xs mt-1.5 max-w-[75%] ${
                    dark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {t("adminTaxonomyDescription")}
                </p>
                <motion.span
                  className="group-hover:opacity-100 absolute right-[10%] top-[50%] translate-y-[-50%] opacity-80 transition group-hover:scale-110 duration-300 h-10 w-10 shadow-soft"
                  transition={motionTheme.springs.hover}
                >
                  <Icon
                    src="/icons/admin-taxo.svg"
                    size="lg"
                    variant="accent"
                    className="h-10 w-10 shadow-soft"
                  />
                </motion.span>
              </motion.div>

              <motion.div
                className={`group w-full rounded-lg p-5 transition relative duration-300 cursor-pointer 
                  hover:translate-y-[3px] opacity-80 hover:opacity-100 ${
                    dark
                      ? "bg-gray-800 hover:shadow-[0_-8px_0px_0px_#546e7a]"
                      : "bg-gray-100 hover:shadow-[0_-8px_0px_0px_#d1d5db]"
                  }`}
                onClick={() => setShowRemoveSampleDataModal(true)}
                whileTap={{ scale: 0.95 }}
                transition={motionTheme.springs.press}
              >
                <p
                  className={`text-lg font-bold ${
                    dark ? "text-gray-100" : "text-gray-800"
                  }`}
                >
                  {t("removeSampleData") || "Remove Sample Data"}
                </p>
                <p
                  className={`text-xs mt-1.5 max-w-[75%] ${
                    dark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {t("removeSampleDataDescription") ||
                    "Clean database from sample transactions and categories"}
                </p>
                <motion.span
                  className="group-hover:opacity-100 absolute right-[10%] top-[50%] translate-y-[-50%] opacity-80 transition group-hover:scale-110 duration-300 h-10 w-10 shadow-soft"
                  transition={motionTheme.springs.hover}
                >
                  <Icon
                    src="/icons/trash.svg"
                    size="lg"
                    variant="danger"
                    className="h-10 w-10 shadow-soft"
                  />
                </motion.span>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SwitchSettings = ({ checked, onChange }) => {
  return <SimpleToggle checked={checked} onChange={onChange} />;
};

// Simple toggle switch component using TailwindCSS
const SimpleToggle = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
        checked ? "bg-cyan-600" : "bg-gray-200 dark:bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
};

export default Settings;
