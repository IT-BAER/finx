import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal";
import { AnimatedPage, AnimatedSection, AnimatedStagger, AnimatedItem } from "../components/AnimatedPage";
import Card from "../components/Card.jsx";
import { adminAPI } from "../services/api.jsx";
import {
  useAdminUsers,
  useCreateAdminUser,
  useUpdateAdminUser,
  useDeleteAdminUser,
} from "../hooks/useQueries.ts";

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

// ─── Tab Definitions ──────────────────────────────────────────────────

const TABS = ["stats", "users", "health", "activity", "auditLogs", "errorLogs"];

// ─── Simple Toggle ────────────────────────────────────────────────────

function SimpleToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 theme-accent-ring ${
        checked ? "theme-accent-bg" : "bg-gray-200 dark:bg-gray-700"
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
}

// ─── Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        accent
          ? "theme-accent-soft-bg border theme-accent-border"
          : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${
          accent
            ? "theme-accent"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("stats");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [activity, setActivity] = useState(null);
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0 });
  const [auditFilter, setAuditFilter] = useState("");
  const [auditOffset, setAuditOffset] = useState(0);
  const [errorLogs, setErrorLogs] = useState({ entries: [], availableFiles: [] });

  // User management state
  const { data: managedUsers = [], isLoading: managedUsersLoading } = useAdminUsers();
  const createUserMutation = useCreateAdminUser();
  const updateUserMutation = useUpdateAdminUser();
  const deleteUserMutation = useDeleteAdminUser();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", first_name: "", last_name: "", is_admin: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showRemoveSampleModal, setShowRemoveSampleModal] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate("/settings", { replace: true });
    }
  }, [user, navigate]);

  const fetchTabData = useCallback(
    async (tab) => {
      setLoading(true);
      setError(null);
      try {
        switch (tab) {
          case "stats": {
            const res = await adminAPI.getDashboardStats();
            setStats(res.data.stats);
            break;
          }
          case "users": {
            // Users tab uses React Query hooks, no manual fetch needed
            break;
          }
          case "health": {
            const res = await adminAPI.getServerHealth();
            setHealth(res.data.health);
            break;
          }
          case "activity": {
            const res = await adminAPI.getActivityOverview();
            setActivity(res.data.activity);
            break;
          }
          case "auditLogs": {
            const params = { limit: 50, offset: auditOffset };
            if (auditFilter) params.action = auditFilter;
            const res = await adminAPI.getAuditLogs(params);
            if (auditOffset > 0) {
              setAuditLogs((prev) => ({
                logs: [...prev.logs, ...res.data.logs],
                total: res.data.total,
              }));
            } else {
              setAuditLogs({ logs: res.data.logs, total: res.data.total });
            }
            break;
          }
          case "errorLogs": {
            const res = await adminAPI.getErrorLogs();
            setErrorLogs(res.data);
            break;
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    },
    [auditOffset, auditFilter]
  );

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // Tab label map
  const tabLabels = {
    stats: t("dashboardStats") || "System Statistics",
    users: t("userManagement") || "User Management",
    health: t("serverHealth") || "Server Health",
    activity: t("activityOverview") || "Activity Overview",
    auditLogs: t("auditLogs") || "Audit Logs",
    errorLogs: t("errorLogs") || "Error Logs",
  };

  // ─── Tab Renderers ───────────────────────────────────────────────

  const renderStats = () => {
    if (!stats) return null;
    return (
      <AnimatedStagger className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
        <AnimatedItem><StatCard label={t("totalUsers")} value={stats.users} accent /></AnimatedItem>
        <AnimatedItem><StatCard
          label={t("activeUsersLast7Days")}
          value={stats.activeUsersLast7Days}
          accent
        /></AnimatedItem>
        <AnimatedItem><StatCard
          label={t("newUsersLast30Days")}
          value={stats.newUsersLast30Days}
          accent
        /></AnimatedItem>
        <AnimatedItem><StatCard label={t("totalTransactions")} value={stats.transactions?.toLocaleString()} /></AnimatedItem>
        <AnimatedItem><StatCard label={t("totalCategories")} value={stats.categories} /></AnimatedItem>
        <AnimatedItem><StatCard label={t("totalGoals")} value={stats.goals} /></AnimatedItem>
        <AnimatedItem><StatCard
          label={t("recurringTransactions")}
          value={stats.recurringTransactions}
        /></AnimatedItem>
        <AnimatedItem><StatCard
          label={t("databaseSize")}
          value={formatBytes(stats.databaseSizeBytes)}
        /></AnimatedItem>
      </AnimatedStagger>
    );

      {/* Remove Sample Data */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("removeSampleData") || "Remove Sample Data"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("removeSampleDataDescription") || "Clean database from sample transactions and categories"}
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowRemoveSampleModal(true)}
            icon={<Icon src="/icons/trash.svg" size="sm" variant="danger" />}
          >
            {t("removeSampleData") || "Remove"}
          </Button>
        </div>
      </div>

      {/* Remove Sample Data Modal */}
      <Modal
        show={showRemoveSampleModal}
        onClose={() => setShowRemoveSampleModal(false)}
        title={t("pleaseConfirm")}
        confirmText={t("delete")}
        onConfirm={async () => {
          try {
            await adminAPI.removeSampleData();
            window.toastWithHaptic.success(t("success"));
            fetchTabData("stats");
          } catch (err) {
            window.toastWithHaptic.error(err.response?.data?.message || t("error"));
          } finally {
            setShowRemoveSampleModal(false);
          }
        }}
      >
        <p>{t("removeSampleDataDescription") || "This will remove all sample transactions and categories."}</p>
      </Modal>
  };

  const renderUsers = () => {
    const usersMutating = createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;
    return (
      <div className="space-y-4">
        {/* Header with add button */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("manageUsers")}
          </h3>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            icon={<Icon src="/icons/add-user.svg" size="md" variant="accent" className="w-6 h-6" />}
          >
            {t("add")}
          </Button>
        </div>

        {/* User list */}
        {managedUsersLoading && managedUsers.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {managedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => {
                  setEditingUser({
                    id: u.id,
                    email: u.email || "",
                    first_name: u.first_name || "",
                    last_name: u.last_name || "",
                    is_admin: !!u.is_admin,
                  });
                  setShowEditModal(true);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {u.first_name && u.last_name
                        ? `${u.first_name} ${u.last_name}`
                        : u.first_name || u.last_name || "—"}
                    </span>
                    {u.is_admin && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {u.email}
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:block">
                  {new Date(u.created_at).toLocaleDateString(t("locale"), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserToDelete(u.id);
                    setShowDeleteModal(true);
                  }}
                  disabled={usersMutating}
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

        {/* Create User Modal */}
        <Modal
          show={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={t("addNewUser")}
          confirmText={t("createUser")}
          onConfirm={async () => {
            try {
              await createUserMutation.mutateAsync(newUser);
              window.toastWithHaptic.success(t("userCreatedSuccessfully"));
              setNewUser({ email: "", password: "", first_name: "", last_name: "", is_admin: false });
              setShowCreateModal(false);
            } catch (err) {
              window.toastWithHaptic.error(err.response?.data?.message || t("failedToCreateUser"));
            }
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group">
              <label className="form-label">{t("firstName")}</label>
              <input
                className="form-input"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("lastName")}</label>
              <input
                className="form-input"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
              />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">{t("email")}</label>
              <input
                type="email"
                className="form-input"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">{t("password")}</label>
              <input
                type="password"
                className="form-input"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                minLength="6"
              />
            </div>
            <div className="form-group flex items-center gap-3 md:col-span-2">
              <label className="form-label">Admin</label>
              <SimpleToggle
                checked={!!newUser.is_admin}
                onChange={(val) => setNewUser({ ...newUser, is_admin: !!val })}
              />
            </div>
          </div>
        </Modal>

        {/* Delete User Modal */}
        <Modal
          show={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); setUserToDelete(null); }}
          title={t("pleaseConfirm")}
          onConfirm={async () => {
            if (!userToDelete) return;
            try {
              await deleteUserMutation.mutateAsync(userToDelete);
              window.toastWithHaptic.success(t("userDeletedSuccessfully"));
            } catch (err) {
              window.toastWithHaptic.error(err.response?.data?.message || t("failedToDeleteUser"));
            } finally {
              setShowDeleteModal(false);
              setUserToDelete(null);
            }
          }}
          confirmText={t("delete")}
        >
          <p>{t("areYouSureYouWantToDeleteThisUser")}</p>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          show={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingUser(null); }}
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
              window.toastWithHaptic.error(err.response?.data?.message || t("failedToLoadUsers"));
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
                  onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("lastName")}</label>
                <input
                  className="form-input"
                  value={editingUser.last_name}
                  onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("email")}</label>
                <input
                  type="email"
                  className="form-input"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div className="form-group flex items-center gap-3">
                <label className="form-label">Admin</label>
                <SimpleToggle
                  checked={!!editingUser.is_admin}
                  onChange={(val) => setEditingUser({ ...editingUser, is_admin: !!val })}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  };

  const renderHealth = () => {
    if (!health) return null;
    const { server, process: proc, database } = health;
    return (
      <div className="space-y-6">
        {/* Server */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Server
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              label={t("serverUptime")}
              value={formatUptime(server.uptimeSeconds)}
              accent
            />
            <StatCard label={t("nodeVersion")} value={server.nodeVersion} />
            <StatCard
              label={t("platform")}
              value={`${server.platform} ${server.arch}`}
            />
            <StatCard label={t("cpuCores")} value={server.cpuCount} />
            <StatCard
              label={t("memoryUsage")}
              value={`${server.freeMemoryMB} / ${server.totalMemoryMB} MB`}
            />
            <StatCard
              label={t("loadAverage")}
              value={server.loadAvg.map((l) => l.toFixed(2)).join(", ")}
            />
          </div>
        </div>

        {/* Process */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t("processMemory")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="RSS" value={`${proc.memoryRSS_MB} MB`} />
            <StatCard
              label={t("heapUsage")}
              value={`${proc.memoryHeapUsed_MB} / ${proc.memoryHeapTotal_MB} MB`}
            />
            <StatCard label="PID" value={proc.pid} />
          </div>
        </div>

        {/* Database */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Database
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <StatCard
              label={t("activeConnections")}
              value={database.activeConnections}
              accent
            />
            <StatCard
              label={t("dbStartedAt")}
              value={formatDate(database.startedAt)}
            />
          </div>
          {database.topTables?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {t("topTables")}
              </h4>
              <div className="space-y-1">
                {database.topTables.map((tbl) => (
                  <div
                    key={tbl.table}
                    className="flex justify-between items-center py-1.5 px-3 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                      {tbl.table}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {tbl.rows.toLocaleString()} rows
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActivity = () => {
    if (!activity) return null;
    return (
      <div className="space-y-6">
        {/* Transactions per day mini chart */}
        {activity.transactionsPerDay?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t("transactionsPerDay")}
            </h3>
            <div className="flex items-end gap-1 h-32 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 overflow-x-auto">
              {(() => {
                const max = Math.max(
                  ...activity.transactionsPerDay.map((d) => d.count),
                  1
                );
                return activity.transactionsPerDay.map((d) => (
                  <div
                    key={d.day}
                    className="flex flex-col items-center flex-1 min-w-[12px]"
                    title={`${d.day}: ${d.count}`}
                  >
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max((d.count / max) * 100, 2)}%`,
                        minHeight: "2px",
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Top users */}
        {activity.topUsersByTransactions?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t("topUsersByActivity")}
            </h3>
            <div className="space-y-2">
              {activity.topUsersByTransactions.map((u) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {u.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {u.count} txns
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top categories */}
        {activity.topCategories?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t("topCategories")}
            </h3>
            <div className="space-y-2">
              {activity.topCategories.map((c) => (
                <div
                  key={c.name}
                  className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {c.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuditLogs = () => {
    const actionTypes = [
      "login",
      "login_failed",
      "register",
      "password_change",
      "account_deleted",
    ];
    return (
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={auditFilter}
            onChange={(e) => {
              setAuditFilter(e.target.value);
              setAuditOffset(0);
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-700 dark:text-gray-200"
          >
            <option value="">{t("allActions")}</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {auditLogs.total} total
          </span>
        </div>

        {auditLogs.logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t("noAuditLogs")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">
                    {t("timestamp")}
                  </th>
                  <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">
                    {t("action")}
                  </th>
                  <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">
                    Email
                  </th>
                  <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium hidden md:table-cell">
                    {t("ipAddress")}
                  </th>
                  <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.action === "login_failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : log.action === "account_deleted"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-700 dark:text-gray-300 text-xs truncate max-w-[150px]">
                      {log.email || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-500 dark:text-gray-400 text-xs font-mono hidden md:table-cell">
                      {log.ip_address || "—"}
                    </td>
                    <td className="py-2 px-2">
                      {log.success ? (
                        <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                          {t("success")}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 text-xs font-medium">
                          {t("failed")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {auditLogs.logs.length < auditLogs.total && (
          <div className="text-center pt-2">
            <Button
              onClick={() => {
                setAuditOffset((prev) => prev + 50);
              }}
              variant="secondary"
              size="sm"
            >
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderErrorLogs = () => {
    return (
      <div className="space-y-4">
        {errorLogs.entries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-green-600 dark:text-green-400 font-medium">
              No errors today
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {errorLogs.entries.map((entry, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm text-red-800 dark:text-red-300 font-mono break-all">
                    {entry.message}
                  </p>
                  {entry.timestamp && (
                    <span className="text-[10px] text-red-400 dark:text-red-500 whitespace-nowrap">
                      {entry.timestamp}
                    </span>
                  )}
                </div>
                {entry.stack && (
                  <pre className="mt-2 text-[10px] text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">
                    {entry.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {errorLogs.availableFiles?.length > 0 && (
          <div className="text-xs text-gray-400 mt-4">
            Log files: {errorLogs.availableFiles.slice(0, 5).join(", ")}
            {errorLogs.availableFiles.length > 5 &&
              ` +${errorLogs.availableFiles.length - 5} more`}
          </div>
        )}
      </div>
    );
  };

  const tabRenderMap = {
    stats: renderStats,
    users: renderUsers,
    health: renderHealth,
    activity: renderActivity,
    auditLogs: renderAuditLogs,
    errorLogs: renderErrorLogs,
  };

  if (!user?.is_admin) return null;

  return (
    <AnimatedPage>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <AnimatedSection delay={0.1} scrollTriggered={false}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate("/settings")}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Icon src="/icons/back.svg" size="sm" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("adminDashboard") || "Admin Dashboard"}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "auditLogs") setAuditOffset(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "theme-accent-soft-bg font-semibold"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2} scrollTriggered={false}>
          {/* Content */}
          <Card>
            <div className="card-body">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              {loading && activeTab !== "users" ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner"></div>
                </div>
              ) : (
                tabRenderMap[activeTab]?.()
              )}
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </AnimatedPage>
  );
};

export default AdminDashboard;
