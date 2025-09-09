import { useState, useEffect } from "react";
import "../utils/haptics.js";
import { useSharing } from "../contexts/SharingContext";
import { useTranslation } from "../hooks/useTranslation";
import { useNavigate, useParams } from "react-router-dom";
import DropdownWithInput from "../components/DropdownWithInput.jsx";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal";
import { motion } from "framer-motion";

const EditSharing = () => {
  const {
    myPermissions,
    getUserSources,
    loading: sharingLoading,
    error: sharingError,
    fetchMyPermissions,
    updatePermission,
    deletePermission,
  } = useSharing();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Removed error state - using toast notifications

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Removed setError call

        // Fetch permissions and sources in parallel
        const [sourcesData] = await Promise.all([
          getUserSources(),
          fetchMyPermissions(),
        ]);

        setSources(sourcesData);
      } catch (err) {
        window.toastWithHaptic.error(t("failedToLoadData"));
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (myPermissions.length > 0) {
      const permission = myPermissions.find((p) => p.id === parseInt(id));
      if (permission) {
        setPermissionLevel(permission.permission_level);

        // Parse source filter if it exists
        if (permission.source_filter) {
          try {
            const sourceIds = JSON.parse(permission.source_filter);
            if (Array.isArray(sourceIds) && sourceIds.length > 0) {
              setSelectedSource(sourceIds[0].toString());
            }
          } catch (err) {
            console.error("Error parsing source_filter:", err);
          }
        }
      }
    }
  }, [myPermissions, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare source filter - if a specific source is selected, create a JSON array with that source ID
      let sourceFilter = null;
      if (selectedSource) {
        sourceFilter = JSON.stringify([parseInt(selectedSource)]);
      }

      await updatePermission(id, {
        permission_level: permissionLevel,
        can_view_income: true,
        can_view_expenses: true,
        source_filter: sourceFilter,
      });

      window.toastWithHaptic.success(t("shareUpdatedSuccessfully"));
      navigate("/share-data");
    } catch (err) {
      window.toastWithHaptic.error(
        err.response?.data?.message || t("failedToUpdateShare"),
      );
      console.error("Error updating sharing permission:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePermission(parseInt(id));
      window.toastWithHaptic.success(t("shareDeletedSuccessfully"));
      navigate("/share-data");
    } catch (err) {
      window.toastWithHaptic.error(t("failedToDeleteShare"));
      console.error("Error deleting sharing permission:", err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-8 sm:py-8">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Removed error display block

  const permission = myPermissions.find((p) => p.id === parseInt(id));

  if (!permission) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-8 sm:py-8">
        <div className="alert alert-error">{t("permissionNotFound")}</div>
      </div>
    );
  }

  return (
<div className="container mx-auto px-4 pb-8 sm:py-8 min-h-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="display-2 leading-none">{t("editSharing")}</h1>
        <div className="flex items-center gap-2">
          {/* Mobile: Circled Icon */}
          <div className="md:hidden">
              <motion.div
                className="icon-circle active:scale-95"
                onClick={() => {
                  navigate("/share-data");
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
              onClick={() => navigate("/share-data")}
              icon={<Icon src="/icons/back.svg" size="md" variant="accent" className="icon-md" />}
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </div>

      <div className="card max-w-2xl mx-auto">
        <div className="card-body">
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {t("sharingWith")}
            </div>
            <div className="font-medium">
              {permission.shared_with_full_name || permission.shared_with_email}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
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

            <div className="mb-6">
              <DropdownWithInput
                id="source"
                name="source"
                label={t("sourceToShare")}
                options={sources.map((source) => source.name)}
                value={
                  selectedSource
                    ? sources.find((s) => s.id == selectedSource)?.name || ""
                    : ""
                }
                onChange={(e) => {
                  const source = sources.find((s) => s.name === e.target.value);
                  setSelectedSource(source ? source.id : "");
                }}
                placeholder={t("allSources")}
              />
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {t("sourceToShareDescription")}
              </div>
            </div>

            <div className="flex justify-between items-center">
              {/* Delete button as icon with tap animation */}
              <div>
                <motion.button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  title={t("delete")}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <Icon
                    src="/icons/trash.svg"
                    variant="danger"
                    className="w-6 h-6"
                  />
                </motion.button>
              </div>

              <div className="flex space-x-2 md:space-x-4">
                <Button
                  type="button"
                  onClick={() => navigate("/share-data")}
                  variant="secondary"
                  disabled={submitting}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  haptic="impact"
                >
                  {submitting ? t("saving") : t("save")}
                </Button>
              </div>
            </div>
            
            {/* Delete Confirmation Modal */}
            <Modal
              show={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              title={t("confirmDelete")}
              onConfirm={handleDelete}
              confirmText={t("delete")}
            >
              <p>{t("deleteSharingConfirmation")}</p>
            </Modal>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditSharing;
