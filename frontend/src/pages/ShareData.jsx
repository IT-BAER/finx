import { useState, useEffect } from "react";
import { useSharing } from "../contexts/SharingContext";
import { useTranslation } from "../hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import DropdownWithInput from "../components/DropdownWithInput.jsx";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal";
import { motion } from "framer-motion";

const ShareData = () => {
  const {
    getAllUsers,
    getUserSources,
    myPermissions,
    sharedWithMe,
    fetchMyPermissions,
    fetchSharedWithMe,
    loading: sharingLoading,
    error: sharingError,
    createPermission,
    deletePermission,
  } = useSharing();

  const { t } = useTranslation();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  // Prefer live context state as the source of truth; keep local for initial render fallback
  const [myPerms, setMyPerms] = useState([]);
  const [sharedToMe, setSharedToMe] = useState([]);
  const [loading, setLoading] = useState(false);
  // Removed error state - using toast notifications
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Removed setError call

        // Fetch users and sources in parallel
        const [usersData, sourcesData] = await Promise.all([
          getAllUsers(),
          getUserSources(),
        ]);

        setUsers(usersData);
        setSources(sourcesData);

        // Kick off context loads; they populate myPermissions/sharedWithMe
        await Promise.all([fetchMyPermissions(), fetchSharedWithMe()]);

        // Fallback to whatever these functions return for first paint
        const perms =
          myPermissions && Array.isArray(myPermissions) ? myPermissions : [];
        const swm =
          sharedWithMe && Array.isArray(sharedWithMe) ? sharedWithMe : [];
        setMyPerms(perms);
        setSharedToMe(swm);
      } catch (err) {
        window.toastWithHaptic.error(t("failedToLoadData"));
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Keep local lists in sync when context updates resolve after first render
  useEffect(() => {
    if (Array.isArray(myPermissions)) setMyPerms(myPermissions);
  }, [myPermissions]);

  useEffect(() => {
    if (Array.isArray(sharedWithMe)) setSharedToMe(sharedWithMe);
  }, [sharedWithMe]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Build payload for ID-only sharing
      const payload = {
        shared_with_user_id: Number(selectedUser),
        permission_level: permissionLevel,
      };
      if (selectedSource) {
        payload.source_filter_ids = [Number(selectedSource)];
      }

      await createPermission(payload);
      window.toastWithHaptic.success(t("shareCreatedSuccessfully"));

      // Refresh context-backed lists
      await fetchMyPermissions();
      await fetchSharedWithMe();

      // Reset form
      setSelectedUser("");
      setSelectedSource("");
      setPermissionLevel("read");
    } catch (err) {
      window.toastWithHaptic.error(
        err.response?.data?.message || t("failedToCreateShare"),
      );
      console.error("Error sharing data:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (perm) => {
    // Navigate to full edit page (existing route)
    navigate(`/edit-sharing/${perm.id}`);
  };

  const handleDelete = async (perm) => {
    try {
      await deletePermission(perm.id);
      window.toastWithHaptic.success(t("shareDeletedSuccessfully"));
      await fetchMyPermissions();
      await fetchSharedWithMe();
    } catch (e) {
      window.toastWithHaptic.error(t("failedToDeleteShare"));
      console.error("Failed to delete permission", e);
    }
  };
  
  const handleDeleteClick = (perm) => {
    setPermissionToDelete(perm);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (permissionToDelete) {
      await handleDelete(permissionToDelete);
      setShowDeleteModal(false);
      setPermissionToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 pb-8 sm:py-8">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Removed error display block

  return (
    <div className="container mx-auto px-4 pb-8 sm:py-8 min-h-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="display-2 leading-none">{t("shareData")}</h1>
        <div className="flex items-center gap-2">
          {/* Mobile: Circled Icon */}
          <div className="md:hidden">
            <motion.div
              className="icon-circle active:scale-95"
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                navigate("/settings");
              }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <img
                src="/icons/back.svg"
                alt=""
                className="w-8 h-8 icon-tint-accent"
              />
            </motion.div>
          </div>

          {/* Desktop: Regular Button */}
          <div className="hidden md:block">
            <Button
              variant="secondary"
              onClick={() => navigate("/settings")}
              icon={<Icon src="/icons/back.svg" size="md" variant="accent" className="icon-md" />}
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column layout: Left = Add Share, Right = lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Add Share */}
        <div className="card h-full">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-4">
              {t("addShare") || "Add Share"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <DropdownWithInput
                  id="user"
                  name="user"
                  label={t("selectUserToShareWith")}
                  required={true}
                  options={users.map((user) => user.full_name || user.email)}
                  value={
                    selectedUser
                      ? users.find((u) => u.id == selectedUser)?.full_name ||
                        users.find((u) => u.id == selectedUser)?.email ||
                        ""
                      : ""
                  }
                  onChange={(e) => {
                    const user = users.find(
                      (u) => (u.full_name || u.email) === e.target.value,
                    );
                    setSelectedUser(user ? user.id : "");
                  }}
                  placeholder={t("selectUser")}
                />
              </div>

              <div className="mb-6">
                <DropdownWithInput
                  id="source"
                  name="source"
                  label={t("selectSourceToShare")}
                  options={sources.map((source) => source.name)}
                  value={
                    selectedSource
                      ? sources.find((s) => s.id == selectedSource)?.name || ""
                      : ""
                  }
                  onChange={(e) => {
                    const source = sources.find(
                      (s) => s.name === e.target.value,
                    );
                    setSelectedSource(source ? source.id : "");
                  }}
                  placeholder={t("shareAllSources")}
                />
              </div>

              <div className="mb-6">
                <label className="form-label">{t("permissionLevel")}</label>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="read"
                      name="permissionLevel"
                      value="read"
                      checked={permissionLevel === "read"}
                      onChange={(e) => setPermissionLevel(e.target.value)}
                      className="mr-3"
                    />
                    <label htmlFor="read" className="flex-1">
                      <div className="font-medium">{t("read")}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t("readPermissionDescription")}
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="read_write"
                      name="permissionLevel"
                      value="read_write"
                      checked={permissionLevel === "read_write"}
                      onChange={(e) => setPermissionLevel(e.target.value)}
                      className="mr-3"
                    />
                    <label htmlFor="read_write" className="flex-1">
                      <div className="font-medium">{t("readWrite")}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t("readWritePermissionDescription")}
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !selectedUser}
                  icon={
                    !submitting && (
                      <Icon
                        src="/icons/share.svg"
                        size="md"
                        variant="accent"
                        className="icon-md"
                      />
                    )
                  }
                >
                  {submitting ? t("sharing") : t("share")}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right column: two stacked lists */}
        <div className="flex flex-col gap-6">
          {/* Shared with others */}
          <div className="card">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-4">
                {t("sharedWithOthers")}
              </h2>
              {myPerms.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("noSharingPermissions")}
                </div>
              ) : (
                <ul className="space-y-2">
                  {myPerms.map((perm) => (
                    <li
                      key={perm.id}
                      className="flex items-center justify-between p-3 rounded-md bg-white/80 dark:bg-gray-800/80 shadow-soft"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {perm.shared_with_full_name ||
                            perm.shared_with_email ||
                            perm.shared_with_user_id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("permissions")}:{" "}
                          {perm.permission_level === "read"
                            ? t("read")
                            : t("readWrite")}
                          {" • "}
{(() => {
  try {
    const ids = perm.source_filter
      ? JSON.parse(perm.source_filter)
      : null;
    if (Array.isArray(ids) && ids.length > 0) {
      // Map IDs to source names
      const sourceNames = ids.map(id => {
        const source = sources.find(s => s.id === id);
        return source ? source.name : id;
      });
      return `${t("source")}: ${sourceNames.join(", ")}`;
    }
    return t("allSources");
  } catch {
    return t("allSources");
  }
})()}
                        </div>
                      </div>
                      <div className="table-action-cell text-right align-middle">
                        <button
                          onClick={() => handleEdit(perm)}
                          className="table-action-button text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title={t("edit")}
                        >
                          <Icon
                            src="/icons/edit.svg"
                            size="sm"
                            variant="accent"
                            alt={t("edit")}
                            className="icon-sm icon-tint-accent"
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(perm)}
                          className="table-action-button text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title={t("delete")}
                        >
                          <Icon
                            src="/icons/trash.svg"
                            size="sm"
                            variant="danger"
                            alt={t("delete")}
                            className="icon-sm icon-tint-danger"
                          />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Shared with me */}
          <div className="card">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-4">
                {t("sharedWithMe")}
              </h2>
              {sharedToMe.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("noDataSharedWithYou")}
                </div>
              ) : (
                <ul className="space-y-2">
                  {sharedToMe.map((perm) => (
                    <li
                      key={perm.id}
                      className="flex items-start justify-between p-3 rounded-md bg-white/80 dark:bg-gray-800/80 shadow-soft"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {perm.owner_full_name ||
                            perm.owner_email ||
                            perm.owner_user_id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("permissions")}:{" "}
                          {perm.permission_level === "read"
                            ? t("read")
                            : t("readWrite")}
                          {" • "}
                          {(() => {
                            try {
                              const ids = perm.source_filter
                                ? JSON.parse(perm.source_filter)
                                : null;
                              if (Array.isArray(ids) && ids.length > 0) {
                                return `${t("source")}: ${ids.join(",")}`;
                              }
                              return t("allSources");
                            } catch {
                              return t("allSources");
                            }
                          })()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t("confirmDelete")}
        onConfirm={confirmDelete}
        confirmText={t("delete")}
      >
        <p>{t("deleteSharingConfirmation")}</p>
      </Modal>
    </div>
  );
};

export default ShareData;
