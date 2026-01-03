import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { useAdminUsers, useCreateAdminUser, useUpdateAdminUser, useDeleteAdminUser } from "../hooks/useQueries";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedSection } from "../components/AnimatedPage";

// Simple toggle switch component (same style used in Settings)
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

const UserManagement = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // React Query hooks for admin user management
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers();
  const createUserMutation = useCreateAdminUser();
  const updateUserMutation = useUpdateAdminUser();
  const deleteUserMutation = useDeleteAdminUser();
  
  // Derive loading state from any mutation
  const loading = usersLoading || createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    is_admin: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Check if user is admin
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUserMutation.mutateAsync(newUser);
      window.toastWithHaptic.success(t("userCreatedSuccessfully"));
      setNewUser({ email: "", password: "", first_name: "", last_name: "", is_admin: false });
      setShowCreateForm(false);
    } catch (err) {
      window.toastWithHaptic.error(
        err.response?.data?.message || t("failedToCreateUser"),
      );
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUserMutation.mutateAsync(userToDelete);
      window.toastWithHaptic.success(t("userDeletedSuccessfully"));
    } catch (err) {
      window.toastWithHaptic.error(
        err.response?.data?.message || t("failedToDeleteUser"),
      );
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const handleInputChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  if (!user || !user.is_admin) {
    return null;
  }

  return (
    <AnimatedPage>
    <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-0">
      <motion.div 
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="display-2 leading-none">{t("userManagement")}</h1>

        <div className="flex items-center gap-2">
          {/* Mobile: Circled Icon */}
          <div className="md:hidden">
            <motion.div
              className="icon-circle active:scale-95"
              onClick={() => navigate(-1)}
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
              onClick={() => navigate(-1)}
              icon={<Icon src="/icons/back.svg" size="md" variant="accent" className="icon-md" />}
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </motion.div>

      <AnimatedSection delay={0.2}>
      <div className="card">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{t("manageUsers")}</h2>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              icon={<Icon src="/icons/add-user.svg" size="md" variant="accent" className="w-6 h-6" />}
            >
              {t("add")}
            </Button>
          </div>

          {/* Create user modal */}
          <Modal
            show={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title={t("addNewUser")}
            confirmText={t("createUser")}
            onConfirm={async () => {
              try {
                await createUserMutation.mutateAsync(newUser);
                window.toastWithHaptic.success(t("userCreatedSuccessfully"));
                setNewUser({
                  email: "",
                  password: "",
                  first_name: "",
                  last_name: "",
                  is_admin: false,
                });
                setShowCreateModal(false);
              } catch (err) {
                window.toastWithHaptic.error(
                  err.response?.data?.message || t("failedToCreateUser"),
                );
              }
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">{t("firstName")}</label>
                <input
                  name="first_name"
                  className="form-input"
                  value={newUser.first_name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, first_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t("lastName")}</label>
                <input
                  name="last_name"
                  className="form-input"
                  value={newUser.last_name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, last_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">{t("email")}</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">{t("password")}</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  required
                  minLength="6"
                />
              </div>

              <div className="form-group flex items-center gap-3 md:col-span-2">
                <label className="form-label">Admin</label>
                <SimpleToggle
                  checked={!!newUser.is_admin}
                  onChange={(val) =>
                    setNewUser({ ...newUser, is_admin: !!val })
                  }
                />
              </div>
            </div>
          </Modal>

          {loading && users.length === 0 ? (
            <div className="flex justify-center items-center h-32">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => {
                    setEditingUser({
                      id: user.id,
                      email: user.email || "",
                      first_name: user.first_name || "",
                      last_name: user.last_name || "",
                      is_admin: !!user.is_admin,
                    });
                    setShowEditModal(true);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.first_name || user.last_name || "-"}
                      </span>
                      {user.is_admin && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:block">
                    {new Date(user.created_at).toLocaleDateString(t("locale"), {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserToDelete(user.id);
                      setShowDeleteModal(true);
                    }}
                    disabled={loading}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors shrink-0"
                  >
                    <img
                      src="/icons/trash.svg"
                      alt={t("delete")}
                      className="w-6 h-6 icon-tint-danger"
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t("pleaseConfirm")}
        onConfirm={handleDeleteUser}
        confirmText={t("delete")}
      >
        <p>{t("areYouSureYouWantToDeleteThisUser")}</p>
      </Modal>

      {/* Edit user modal */}
      <Modal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t("edit")}
        confirmText={t("save")}
        onConfirm={async () => {
          if (!editingUser) return;
          try {
            await updateUserMutation.mutateAsync({
              id: editingUser.id,
              data: {
                first_name: editingUser.first_name,
                last_name: editingUser.last_name,
                email: editingUser.email,
                is_admin: editingUser.is_admin,
              },
            });
            window.toastWithHaptic.success(t("success"));
            setShowEditModal(false);
            setEditingUser(null);
          } catch (err) {
            window.toastWithHaptic.error(
              err.response?.data?.message || t("failedToLoadUsers"),
            );
          }
        }}
      >
        {editingUser && (
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">{t("firstName")}</label>
              <input
                className="form-input"
                value={editingUser.first_name}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, first_name: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("lastName")}</label>
              <input
                className="form-input"
                value={editingUser.last_name}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, last_name: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("email")}</label>
              <input
                type="email"
                className="form-input"
                value={editingUser.email}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, email: e.target.value })
                }
              />
            </div>

            <div className="form-group flex items-center gap-3">
              <label className="form-label">Admin</label>
              <SimpleToggle
                checked={!!editingUser.is_admin}
                onChange={(val) =>
                  setEditingUser({ ...editingUser, is_admin: !!val })
                }
              />
            </div>
          </div>
        )}
      </Modal>
      </AnimatedSection>
    </div>
    </AnimatedPage>
  );
};

export default UserManagement;
