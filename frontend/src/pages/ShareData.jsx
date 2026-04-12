import { useState, useMemo } from "react";
import { useTranslation } from "../hooks/useTranslation";
import {
  useSharingPermissions,
  useSharedWithMe,
  useMyShareCode,
  useSharingSources,
  useCreateSharingPermission,
  useDeleteSharingPermission
} from "../hooks/useQueries";
import { useNavigate } from "react-router-dom";
import { sharingAPI } from "../services/api";
import DropdownWithInput from "../components/DropdownWithInput.jsx";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedSection } from "../components/AnimatedPage";

import Card from "../components/Card";
const ShareData = () => {
  // React Query hooks for sharing data
  const { data: myPermissions = [], isLoading: permissionsLoading } = useSharingPermissions();
  const { data: sharedWithMe = [], isLoading: sharedWithMeLoading } = useSharedWithMe();
  const { data: myShareCode = "", isLoading: shareCodeLoading, refetch: refetchShareCode } = useMyShareCode();
  const { data: sourcesData = [], isLoading: sourcesLoading } = useSharingSources();
  
  // Mutation hooks
  const createPermissionMutation = useCreateSharingPermission();
  const deletePermissionMutation = useDeleteSharingPermission();

  const { t } = useTranslation();
  const navigate = useNavigate();

  // Derive loading state
  const loading = permissionsLoading || sharedWithMeLoading || shareCodeLoading || sourcesLoading;
  const submitting = createPermissionMutation.isPending || deletePermissionMutation.isPending;

  // Form state
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [resolvedUser, setResolvedUser] = useState(null);
  const [selectedSource, setSelectedSource] = useState("");
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState(null);
  const [resolving, setResolving] = useState(false);

  // Process sources to add display names for shared sources
  const sources = useMemo(() => {
    const arr = Array.isArray(sourcesData) ? sourcesData : [];
    return arr.map(source => {
      if (source.ownership_type === 'shared') {
        const ownerName = source.owner_first_name || source.owner_email || 'Unknown';
        return {
          ...source,
          displayName: `${source.name} (${ownerName})`,
          name: source.name
        };
      }
      return {
        ...source,
        displayName: source.name,
        name: source.name
      };
    });
  }, [sourcesData]);
  
  // Use query data directly
  const myPerms = useMemo(() => {
    return Array.isArray(myPermissions) ? myPermissions : [];
  }, [myPermissions]);
  
  const sharedToMe = useMemo(() => {
    return Array.isArray(sharedWithMe) ? sharedWithMe : [];
  }, [sharedWithMe]);

  // Resolve share code when it reaches 8 chars
  const handleShareCodeChange = async (value) => {
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setShareCodeInput(code);
    setResolvedUser(null);

    if (code.length === 8) {
      setResolving(true);
      try {
        const res = await sharingAPI.resolveShareCode(code);
        setResolvedUser(res.data?.data || null);
      } catch {
        setResolvedUser(null);
      } finally {
        setResolving(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!shareCodeInput || shareCodeInput.length !== 8) {
      window.toastWithHaptic.error(t("shareCodeRequired"));
      return;
    }

    try {
      const payload = {
        share_code: shareCodeInput,
        permission_level: permissionLevel,
      };
      if (selectedSource) {
        payload.source_filter_ids = [Number(selectedSource)];
      }

      await createPermissionMutation.mutateAsync(payload);
      window.toastWithHaptic.success(t("shareCreatedSuccessfully"));

      // Reset form
      setShareCodeInput("");
      setResolvedUser(null);
      setSelectedSource("");
      setPermissionLevel("read");
    } catch (err) {
      window.toastWithHaptic.error(
        err.response?.data?.message || t("failedToCreateShare"),
      );
      console.error("Error sharing data:", err);
    }
  };

  const handleEdit = async (perm) => {
    // Navigate to full edit page (existing route)
    navigate(`/edit-sharing/${perm.id}`);
  };

  const handleDelete = async (perm) => {
    try {
      await deletePermissionMutation.mutateAsync(perm.id);
      window.toastWithHaptic.success(t("shareDeletedSuccessfully"));
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
    <AnimatedPage>
    <div className="container mx-auto px-4 pb-8 sm:py-8 min-h-0">
      <motion.div 
        className="flex justify-between items-center mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
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
      </motion.div>

      <AnimatedSection delay={0.2}>
      {/* Two-column layout: Left = Add Share, Right = lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Add Share */}
        <Card className="h-full">
          <div className="card-body">
            {/* My Share Code display */}
            <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/20">
              <h3 className="text-sm font-semibold mb-1">{t("myShareCode")}</h3>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-widest select-all">
                  {myShareCode || "—"}
                </span>
                <button
                  type="button"
                  className="text-xs underline opacity-70 hover:opacity-100"
                  onClick={async () => {
                    if (navigator.clipboard && myShareCode) {
                      await navigator.clipboard.writeText(myShareCode);
                      window.toastWithHaptic.success(t("copied"));
                    }
                  }}
                >
                  {t("copy") || "Copy"}
                </button>
                <button
                  type="button"
                  className="text-xs underline opacity-70 hover:opacity-100 text-red-500"
                  onClick={async () => {
                    try {
                      await sharingAPI.regenerateShareCode();
                      refetchShareCode();
                      window.toastWithHaptic.success(t("shareCodeRegenerated") || "Share code regenerated");
                    } catch {
                      window.toastWithHaptic.error(t("error"));
                    }
                  }}
                >
                  {t("regenerateShareCode")}
                </button>
              </div>
              <p className="text-xs opacity-60 mt-1">
                {t("shareCodeHint")}
              </p>
            </div>

            <h2 className="text-xl font-semibold mb-4">
              {t("addShare") || "Add Share"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="form-label" htmlFor="shareCode">
                  {t("enterShareCode")}
                </label>
                <input
                  id="shareCode"
                  type="text"
                  className="form-control font-mono tracking-widest text-center text-lg uppercase"
                  maxLength={8}
                  value={shareCodeInput}
                  onChange={(e) => handleShareCodeChange(e.target.value)}
                  placeholder="ABCD1234"
                  required
                />
                {resolving && (
                  <p className="text-sm text-gray-500 mt-1">{t("loading")}...</p>
                )}
                {resolvedUser && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {resolvedUser.first_name} {resolvedUser.last_name}
                  </p>
                )}
                {shareCodeInput.length === 8 && !resolving && !resolvedUser && (
                  <p className="text-sm text-red-500 mt-1">
                    {t("invalidShareCode") || "Invalid share code"}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <DropdownWithInput
                  id="source"
                  name="source"
                  label={t("selectSourceToShare")}
                  options={sources.map((source) => source.displayName)}
                  value={
                    selectedSource
                      ? sources.find((s) => s.id == selectedSource)?.displayName || ""
                      : ""
                  }
                  onChange={(e) => {
                    const source = sources.find(
                      (s) => s.displayName === e.target.value,
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
                  disabled={submitting || shareCodeInput.length !== 8 || !resolvedUser}
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
        </Card>

        {/* Right column: two stacked lists */}
        <div className="flex flex-col gap-6">
          {/* Shared with others */}
          <Card>
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
          </Card>

          {/* Shared with me */}
          <Card>
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
          </Card>
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
      </AnimatedSection>
    </div>
    </AnimatedPage>
  );
};

export default ShareData;
