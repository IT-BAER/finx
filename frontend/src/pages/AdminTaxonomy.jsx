import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import { adminAPI } from "../services/api.jsx";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { motion, AnimatePresence } from "framer-motion";

const AdminTaxonomy = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [consolidateFrom, setConsolidateFrom] = useState("");
  const [consolidateTo, setConsolidateTo] = useState("");
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);

  // Clear selections and modal state when switching between tabs
  useEffect(() => {
    setSelectedItems([]);
    setShowDeleteModal(false);
    setShowRenameModal(false);
    setShowConsolidateModal(false);
    setConsolidateFrom("");
    setConsolidateTo("");
    setNewName("");
  }, [activeTab]);

  // When opening consolidate modal, prefill from/to if two (or more) selected
  useEffect(() => {
    if (!showConsolidateModal) return;
    if (selectedItems && selectedItems.length > 0) {
      setConsolidateFrom((prev) => prev || String(selectedItems[0]));
      if (selectedItems.length > 1) {
        const second = selectedItems.find((id) => String(id) !== String(selectedItems[0]));
        if (second) setConsolidateTo((prev) => prev || String(second));
      }
    }
  }, [showConsolidateModal]);

  useEffect(() => {
    if (!user || !user.is_admin) {
      navigate("/dashboard");
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [categoriesRes, sourcesRes, targetsRes] = await Promise.all([
        adminAPI.getCategories(),
        adminAPI.getSources(),
        adminAPI.getTargets(),
      ]);

      setCategories(categoriesRes.data.data || []);
      setSources(sourcesRes.data.data || []);
      setTargets(targetsRes.data.data || []);
    } catch (err) {
      setError(t("failedToLoadData"));
      console.error("Error loading taxonomy data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    const items =
      activeTab === "categories"
        ? categories
        : activeTab === "sources"
          ? sources
          : targets;
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((item) => item.id));
    }
  };

  const handleDelete = async () => {
    try {
      const api =
        activeTab === "categories"
          ? adminAPI.deleteCategory
          : activeTab === "sources"
            ? adminAPI.deleteSource
            : adminAPI.deleteTarget;

      await Promise.all(
        selectedItems.map(async (id) => {
          try {
            await api(id);
          } catch (err) {
            const status = err?.response?.status;
            const data = err?.response?.data;
            if (status === 409 && data?.reassignRequired) {
              // Show a clear error with count and do not open consolidate modal
              const count = Number(data?.refCount ?? 0);
              setError(
                t("itemUsedInTransactionsWithCount", { count }),
              );
              // Stop further processing
              throw err;
            }
            throw err;
          }
        }),
      );
      await loadData();
      setSelectedItems([]);
      setShowDeleteModal(false);
    } catch (err) {
      // If it's not the specific referenced case, show generic error
      if (!err?.response || err.response.status !== 409) {
        setError(t("failedToDeleteItems"));
      }
      // Close modal after attempt
      setShowDeleteModal(false);
      console.error("Error deleting items:", err);
    }
  };

  const handleRename = async () => {
    try {
      if (!newName.trim()) return;

      const api =
        activeTab === "categories"
          ? adminAPI.renameCategory
          : activeTab === "sources"
            ? adminAPI.renameSource
            : adminAPI.renameTarget;

      await api(selectedItems[0], { name: newName.trim() });
      await loadData();
      setSelectedItems([]);
      setShowRenameModal(false);
      setNewName("");
    } catch (err) {
      setError(t("failedToUpdateItem"));
      console.error("Error renaming item:", err);
    }
  };

  const handleConsolidate = async () => {
    try {
      if (!consolidateTo) return;

      if (activeTab === "categories") {
        await adminAPI.mergeCategory(consolidateFrom, {
          into_category_id: consolidateTo,
        });
      } else {
        // For sources and targets, use delete with reassign parameter
        const api =
          activeTab === "sources"
            ? adminAPI.deleteSource
            : adminAPI.deleteTarget;
        await api(consolidateFrom, consolidateTo);
      }

      await loadData();
      setSelectedItems([]);
      setShowConsolidateModal(false);
      setConsolidateFrom("");
      setConsolidateTo("");
    } catch (err) {
      setError(t("failedToConsolidateItems"));
      console.error("Error consolidating items:", err);
    }
  };

  const getItems = () => {
    switch (activeTab) {
      case "categories":
        return categories;
      case "sources":
        return sources;
      case "targets":
        return targets;
      default:
        return [];
    }
  };

  const getAvailableOptions = () => {
    const items = getItems();
    // Start with selected items if any are selected; otherwise fall back to all items
    let pool = Array.isArray(selectedItems) && selectedItems.length > 0
      ? items.filter((item) => selectedItems.includes(item.id))
      : items;

    // For sources, restrict consolidation target to same owner as the chosen "from"
    if (activeTab === "sources" && consolidateFrom) {
      const fromItem = items.find((i) => String(i.id) === String(consolidateFrom));
      if (fromItem && fromItem.user_id != null) {
        const ownerId = Number(fromItem.user_id);
        pool = pool.filter((item) => Number(item.user_id) === ownerId);
      }
    }
    // Exclude the currently selected "from" item only
    return pool.filter((item) => String(item.id) !== String(consolidateFrom));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-6 pb-8">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-8 min-h-0">
      <div className="flex items-center justify-between mb-8">
        <h1 className="display-2">{t("adminTaxonomy")}</h1>

        <div className="flex items-center gap-2">
          {/* Mobile: Circled Icon */}
          <div className="md:hidden">
            <motion.div
              className="icon-circle active:scale-95"
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                navigate(-1);
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
              onClick={() => navigate(-1)}
              icon={
                <img
                  src="/icons/back.svg"
                  alt=""
                  className="icon icon-md icon-tint-accent"
                />
              }
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <motion.button
          onClick={() => {
            // Remove haptic feedback - only notifications and "+" button should have haptic
            setActiveTab("categories");
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "categories"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {t("categories")}
        </motion.button>
        <motion.button
          onClick={() => {
            // Remove haptic feedback - only notifications and "+" button should have haptic
            setActiveTab("sources");
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "sources"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {t("sources")}
        </motion.button>
        <motion.button
          onClick={() => {
            // Remove haptic feedback - only notifications and "+" button should have haptic
            setActiveTab("targets");
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "targets"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {t("targets")}
        </motion.button>
      </div>

      {/* Items List */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedItems.length === getItems().length &&
                    getItems().length > 0
                  }
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t("selectAll")}
                </span>
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedItems.length} {t("selected")}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-2"
              >
                {getItems().map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedItems.includes(item.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => handleSelect(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                      {(() => {
                        const isGlobal =
                          item.user_id == null || Number(item.user_id) === 0;
                        if (isGlobal) return "Global";
                        const first = (item.first_name || "").trim();
                        const last = (item.last_name || "").trim();
                        const name = [first, last].filter(Boolean).join(" ");
                        const email = (item.email || "").trim();
                        return name || (email ? email : `#${item.user_id}`);
                      })()}
                      {item.email &&
                        item.user_id != null &&
                        Number(item.user_id) !== 0 && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-500">
                            {item.email}
                          </div>
                        )}
                    </div>
                  </motion.div>
                ))}

                {getItems().length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                  >
                    {t("noItemsFound")}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-between items-center mt-6">
            {/* Delete icon on the left */}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={selectedItems.length === 0}
              className={`p-2 rounded-full transition-colors ${
                selectedItems.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-red-100 dark:hover:bg-red-900/30"
              }`}
              title={t("delete")}
            >
              <img
                src="/icons/trash.svg"
                alt={t("delete")}
                className="w-6 h-6 icon-tint-danger"
              />
            </button>

            {/* Other buttons on the right */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowConsolidateModal(true)}
                disabled={selectedItems.length < 2}
                variant="primary"
              >
                {t("consolidate")}
              </Button>
              <Button
                onClick={() => setShowRenameModal(true)}
                disabled={selectedItems.length !== 1}
                variant="secondary"
              >
                {t("rename")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t("pleaseConfirm")}
        onConfirm={handleDelete}
        confirmText={t("delete")}
      >
        <p>
          {t("areYouSureYouWantToDeleteTheseItems", {
            count: selectedItems.length,
          })}
        </p>
      </Modal>

      {/* Rename Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowRenameModal(false);
              setNewName("");
            }}
          >
            <motion.div
              className="bg-white/95 dark:bg-gray-800/95 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">{t("renameItem")}</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("newName")}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="form-input w-full"
                  placeholder={t("enterNewName")}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowRenameModal(false);
                    setNewName("");
                  }}
                  variant="secondary"
                >
                  {t("cancel")}
                </Button>
                <Button onClick={handleRename} variant="primary">
                  {t("rename")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Consolidate Modal */}
      <AnimatePresence>
        {showConsolidateModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowConsolidateModal(false);
              setConsolidateFrom("");
              setConsolidateTo("");
            }}
          >
            <motion.div
              className="bg-white/95 dark:bg-gray-800/95 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {t("consolidateItems")}
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("consolidateFrom")}
                </label>
                <select
                  value={consolidateFrom}
                  onChange={(e) => setConsolidateFrom(e.target.value)}
                  className="form-input w-full"
                >
                  <option value="">{t("selectItem")}</option>
                  {selectedItems.map((id) => {
                    const item = getItems().find((i) => i.id === id);
                    return item ? (
                      <option key={id} value={id}>
                        {item.name}
                      </option>
                    ) : null;
                  })}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("consolidateTo")}
                </label>
                <select
                  value={consolidateTo}
                  onChange={(e) => setConsolidateTo(e.target.value)}
                  className="form-input w-full"
                >
                  <option value="">{t("selectItem")}</option>
                  {getAvailableOptions().map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowConsolidateModal(false);
                    setConsolidateFrom("");
                    setConsolidateTo("");
                  }}
                  variant="secondary"
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleConsolidate}
                  disabled={!consolidateFrom || !consolidateTo}
                  variant="primary"
                >
                  {t("consolidate")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTaxonomy;
