import { useState, useEffect } from "react";
import "../utils/haptics.js";
import { useNavigate, useParams } from "react-router-dom";
import offlineAPI from "../services/offlineAPI.js";
import { recurringTransactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import Dropdown from "../components/Dropdown.jsx";
import DropdownWithInput from "../components/DropdownWithInput.jsx";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import Input from "../components/Input";
import Modal from "../components/Modal";
import { motion } from "framer-motion";

const EditTransaction = () => {
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [formData, setFormData] = useState({
    category_id: "",
    category: "",
    amount: "",
    type: "expense",
    description: "",
    source: "",
    target: "",
    date: "",
    // Recurring transaction fields
    isRecurring: false,
    recurrence_type: "monthly",
    recurrence_interval: 1,
    end_date: "",
    max_occurrences: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, language, formatCurrency } = useTranslation();

  useEffect(() => {
    loadCategories();
    loadSources();
    loadTargets();
    if (id) {
      loadTransaction();
    }
  }, [id]);

  // Remove unbounded debug effect that forces render noise
  // useEffect(() => {
  //   console.log('Component re-rendered with id:', id);
  // }, [id]);

  // Remove noisy logging that can obscure issues
  // useEffect(() => {
  //   console.log('formData updated:', formData);
  // }, [formData]);

  const loadSources = async () => {
    try {
      console.log("Loading sources...");
      const res = await offlineAPI.getSources();
      console.log("Sources data:", res);
      // Normalize to array of strings for DropdownWithInput
      // Handle different response formats
      let sourcesArray = [];
      if (Array.isArray(res)) {
        // Direct array response (cached data)
        sourcesArray = res;
      } else if (res && typeof res === "object") {
        // Object response with data property
        if (Array.isArray(res.sources)) {
          sourcesArray = res.sources;
        } else if (Array.isArray(res.data?.sources)) {
          sourcesArray = res.data.sources;
        } else if (Array.isArray(res.data)) {
          sourcesArray = res.data;
        }
      }

      // Convert to array of strings
      const list = sourcesArray
        .map((s) => (typeof s === "string" ? s : s?.name))
        .filter(Boolean);
      console.log("Normalized sources:", list);
      setSources(list);
    } catch (err) {
      console.error("Error loading sources:", err);
      // Set empty array to prevent UI issues
      setSources([]);
    }
  };

  const loadTargets = async () => {
    try {
      console.log("Loading targets...");
      const res = await offlineAPI.getTargets();
      console.log("Targets data:", res);
      // Normalize to array of strings for DropdownWithInput
      // Handle different response formats
      let targetsArray = [];
      if (Array.isArray(res)) {
        // Direct array response (cached data)
        targetsArray = res;
      } else if (res && typeof res === "object") {
        // Object response with data property
        if (Array.isArray(res.targets)) {
          targetsArray = res.targets;
        } else if (Array.isArray(res.data?.targets)) {
          targetsArray = res.data.targets;
        } else if (Array.isArray(res.data)) {
          targetsArray = res.data;
        }
      }

      // Convert to array of strings
      const list = targetsArray
        .map((t) => (typeof t === "string" ? t : t?.name))
        .filter(Boolean);
      console.log("Normalized targets:", list);
      setTargets(list);
    } catch (err) {
      console.error("Error loading targets:", err);
      // Set empty array to prevent UI issues
      setTargets([]);
    }
  };

  const loadCategories = async () => {
    try {
      console.log("Loading categories...");
      const res = await offlineAPI.getCategories();
      console.log("Categories data:", res);
      // Normalize to array of {id,name}
      // Handle different response formats
      let categoriesArray = [];
      if (Array.isArray(res)) {
        // Direct array response (cached data)
        categoriesArray = res;
      } else if (res && typeof res === "object") {
        // Object response with data property
        if (Array.isArray(res.categories)) {
          categoriesArray = res.categories;
        } else if (Array.isArray(res.data?.categories)) {
          categoriesArray = res.data.categories;
        } else if (Array.isArray(res.data)) {
          categoriesArray = res.data;
        }
      }
      console.log("Normalized categories:", categoriesArray);
      setCategories(categoriesArray);
    } catch (err) {
      console.error("Error loading categories:", err);
      // Set empty array to prevent UI issues
      setCategories([]);
    }
  };

  const loadTransaction = async () => {
    try {
      console.log("Loading transaction with ID:", id);
      const transaction = await offlineAPI.getTransactionById(id);

      console.log("Transaction data:", transaction);

      // Handle date properly to avoid timezone issues
      let formattedDate = "";

      // If date is a string in YYYY-MM-DD format, use it as is
      if (
        typeof transaction.date === "string" &&
        transaction.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        formattedDate = transaction.date;
      } else if (typeof transaction.date === "string") {
        // If it's a full date string, we need to be more careful about timezone handling
        // For PostgreSQL DATE type, we should treat it as local time
        const dateObj = new Date(transaction.date);
        formattedDate =
          dateObj.getFullYear() +
          "-" +
          String(dateObj.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(dateObj.getDate()).padStart(2, "0");
      } else if (transaction.date instanceof Date) {
        // If it's already a Date object, format it properly
        formattedDate =
          transaction.date.getFullYear() +
          "-" +
          String(transaction.date.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(transaction.date.getDate()).padStart(2, "0");
      }

      console.log("Setting form data with:", {
        category_id: transaction.category_id || "",
        category: transaction.category_name || transaction.category || "",
        amount: transaction.amount || "",
        type: transaction.type || "expense",
        description: transaction.description || "",
        source: transaction.source_name || transaction.source || "",
        target: transaction.target_name || transaction.target || "",
        date: formattedDate,
      });

      // Ensure all values are strings to prevent controlled/uncontrolled issues
      setFormData({
        // Clear category_id as well when transaction is income so UI state doesn't keep the DB value
        category_id:
          transaction.type === "income"
            ? ""
            : transaction.category_id
            ? String(transaction.category_id)
            : "",
        // If this transaction is an income, we clear category (categories are only for expenses)
        category:
          transaction.type === "income"
            ? ""
            : transaction.category_name || transaction.category || "",
        amount: transaction.amount ? String(transaction.amount) : "",
        type: transaction.type || "expense",
        description: transaction.description || "",
        // For income transactions, swap the source/target mapping from backend
        source: transaction.type === "income" 
          ? (transaction.target_name || transaction.target || "")  // Frontend source = backend target
          : (transaction.source_name || transaction.source || ""), // Frontend source = backend source
        target: transaction.type === "income"
          ? (transaction.source_name || transaction.source || "")  // Frontend target = backend source
          : (transaction.target_name || transaction.target || ""), // Frontend target = backend target
        date: formattedDate,
        isRecurring: !!transaction.recurring,
        recurrence_type: transaction.recurring?.recurrence_type || "monthly",
        recurrence_interval: transaction.recurring?.recurrence_interval || 1,
        end_date: transaction.recurring?.end_date || "",
        max_occurrences: transaction.recurring?.max_occurrences || "",
        recurring_id: transaction.recurring?.id || null,
      });
    } catch (err) {
      setError(t("failedToLoadTransaction"));
      console.error("Error loading transaction:", err);
      // Set default form data to prevent UI issues
      setFormData({
        category_id: "",
        category: "",
        amount: "",
        type: "expense",
        description: "",
        source: "",
        target: "",
        date: "",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const result = await offlineAPI.deleteTransaction(id);
      if (result.queued) {
        window.toastWithHaptic.info(t("changesQueuedOffline"));
      } else {
        window.toastWithHaptic.success(t("transactionDeleted"));
      }
      window.dispatchEvent(new CustomEvent("transactionDeleted"));
      navigate("/transactions");
    } catch (err) {
      window.toastWithHaptic.error(t("failedToDeleteTransaction"));
      console.error("Error deleting transaction:", err);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // When switching type to income clear category and category_id; otherwise keep values
    if (name === "type") {
      if (value === "income") {
        setFormData({ ...formData, type: value, category: "", category_id: "" });
      } else {
        setFormData({ ...formData, type: value });
      }
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");
    
  // Validation
  const catTrim = String(formData.category || "").trim();
  const srcTrim = String(formData.source || "").trim();
  const tgtTrim = String(formData.target || "").trim();
  if ((formData.type !== "income" && !catTrim) || !formData.amount || !formData.date || (formData.type === "income" && !String(formData.description || "").trim())) {
        setError(t("pleaseFillAllRequiredFields"));
        setLoading(false);
        return;
      }

      // For expenses, source is required
  if (formData.type !== "income" && !srcTrim) {
        setError(t("pleaseProvideSource") || t("pleaseFillAllRequiredFields"));
        setLoading(false);
        return;
      }

      // For income, target is required
  if (formData.type === "income" && !tgtTrim) {
        setError(t("pleaseProvideTarget") || t("pleaseFillAllRequiredFields"));
        setLoading(false);
        return;
      }
    
      if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
        setError(t("pleaseEnterValidAmount"));
        setLoading(false);
        return;
      }
    
      try {
        // Default empty target to localized "Misc"/"Sonstiges"
        const defaultTarget = language === "de" ? "Sonstiges" : "Misc";
        
        let dataToSend;
        if (formData.type === "income") {
          // For income transactions, swap source and target in the backend payload
          // Frontend: source = refund origin (Amazon), target = destination (Bank)
          // Backend: source = destination (Bank), target = refund origin (Amazon)
          dataToSend = {
            ...formData,
            category: "", // Income has no category
            category_id: null,
            source: String(formData.target || "").trim() || defaultTarget, // Backend source = frontend target
            target: String(formData.source || "").trim(), // Backend target = frontend source
          };
        } else {
          // For expense transactions, keep normal mapping
          dataToSend = {
            ...formData,
            category: String(formData.category || "").trim(),
            source: String(formData.source || "").trim(),
            target: String(formData.target || "").trim() || defaultTarget,
          };
        }

        // First, update the base transaction
        const result = await offlineAPI.updateTransaction(id, dataToSend);
        if (result.queued) {
          window.toastWithHaptic.info(t("changesQueuedOffline"));
        } else if (result) {
          window.toastWithHaptic.success(t("transactionUpdatedSuccess"));
        }
    
        const recurringData = {
          title:
            formData.description ||
            `${formData.type === "income" ? t("income") : t("expense")} - ${formData.category}`,
          amount: parseFloat(formData.amount),
          type: formData.type,
          category_id:
            formData.type === "income"
              ? null
              : categories.find((c) => String(c.name || "").trim().toLowerCase() === String(formData.category || "").trim().toLowerCase())?.id || null,
          // Use the same field mapping as dataToSend for consistency
          source: String(dataToSend.source || "").trim() || null,
          target: String(dataToSend.target || "").trim() || null,
          description: formData.description || null,
          recurrence_type: formData.recurrence_type,
          recurrence_interval: parseInt(formData.recurrence_interval),
          start_date: formData.date,
          end_date: formData.end_date || null,
          max_occurrences: formData.max_occurrences
            ? parseInt(formData.max_occurrences)
            : null,
        transaction_id: id,
        };

      if (formData.isRecurring) {
        if (formData.recurring_id) {
          // Update existing recurring transaction
          await recurringTransactionAPI.update(
            formData.recurring_id,
            recurringData,
          );
          window.toastWithHaptic.success(t("recurringTransactionUpdated"));
        } else {
          // Create new recurring transaction
          await recurringTransactionAPI.create(recurringData);
          window.toastWithHaptic.success(t("recurringTransactionCreated"));
        }
      } else if (formData.recurring_id) {
        // If it was recurring, but now it's not, delete the recurring transaction
        await recurringTransactionAPI.delete(formData.recurring_id);
        window.toastWithHaptic.success(t("recurringTransactionRemoved"));
      }

      // Dispatch a custom event to notify the Transactions page to refresh
      window.dispatchEvent(new CustomEvent("transactionUpdated"));
      navigate("/transactions");
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || t("failedToUpdateTransaction");
      window.toastWithHaptic.error(errorMessage);
      console.error("Error saving transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 pt-0 pb-8 sm:pb-8 min-h-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="display-2 leading-none">{t("editTransactionTitle")}</h1>
        <div className="flex items-center gap-2">
          {/* Mobile: Circled Icon */}
          <div className="md:hidden">
            <motion.div
              className="icon-circle active:scale-95"
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                navigate("/transactions");
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
              onClick={() => navigate("/transactions")}
              icon={
                <Icon src="/icons/back.svg" size="md" variant="accent" className="icon-md" />
              }
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group md:col-span-2">
                <label htmlFor="type" className="form-label">
                  {t("type")} *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === "income" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value="income"
                      checked={formData.type === "income"}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="font-medium">{t("income")}</span>
                    </div>
                  </label>
                  <label
                    className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === "expense" ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value="expense"
                      checked={formData.type === "expense"}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-red-500 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="font-medium">{t("expense")}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <Input
                  type="date"
                  id="date"
                  name="date"
                  label={t("date")}
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              {formData.type !== "income" && (
              <div className="form-group">
                <DropdownWithInput
                  id="category"
                  name="category"
                  label={t("category")}
                  required={true}
                  options={categories.map((c) => c.name).filter(Boolean)}
                  value={formData.category || ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next !== formData.category) {
                      setFormData({ ...formData, category: next });
                    }
                  }}
                  onCreate={async (name) => {
                    try {
                      const trimmed = String(name || "").trim();
                      if (!trimmed) return;
                      if (!categories.some((c) => String(c.name || "").trim().toLowerCase() === trimmed.toLowerCase())) {
                        setCategories([
                          ...categories,
                          { id: Date.now(), name: trimmed },
                        ]);
                      }
                      if (trimmed !== formData.category) {
                        setFormData({ ...formData, category: trimmed });
                      }
                    } catch (err) {
                      console.error("Error creating category:", err);
                    }
                  }}
                  placeholder={t("selectCategory")}
                />
              </div>
              )}

              <div className="form-group">
                <label htmlFor="amount" className="form-label">
                  {t("amount")} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">
                      {language === "de" ? "€" : "$"}
                    </span>
                  </div>
                  <Input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={t("amount")}
                    className="form-input-with-prefix"
                  />
                </div>
              </div>

              <div className="form-group md:col-span-2">
                <Input
                  type="text"
                  id="description"
                  name="description"
                  label={t("description")}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder={t("enterDescription")}
                  required={formData.type === "income"}
                />
              </div>

              <div className="form-group">
                <DropdownWithInput
                  id="source"
                  name="source"
                  label={t("source")}
                  required={formData.type !== "income"}
                  options={formData.type === "income" ? targets : sources}
                  value={formData.source || ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next !== formData.source) {
                      setFormData({ ...formData, source: next });
                    }
                  }}
                  onCreate={async (name) => {
                    try {
                      const trimmed = String(name || "").trim();
                      if (!trimmed) return;
                      // For income, source (refund origin) should go to targets list
                      // For expense, source (funding) should go to sources list
                      if (formData.type === "income") {
                        if (!targets.some((n) => String(n).trim().toLowerCase() === trimmed.toLowerCase())) {
                          setTargets([...targets, trimmed]);
                        }
                      } else {
                        if (!sources.some((n) => String(n).trim().toLowerCase() === trimmed.toLowerCase())) {
                          setSources([...sources, trimmed]);
                        }
                      }
                      if (trimmed !== formData.source) {
                        setFormData({ ...formData, source: trimmed });
                      }
                    } catch (err) {
                      console.error("Error handling new source:", err);
                    }
                  }}
                  placeholder={t("enterSource")}
                />
              </div>

              <div className="form-group">
                <DropdownWithInput
                  id="target"
                  name="target"
                  label={t("target")}
                  required={formData.type === "income"}
                  options={formData.type === "income" ? sources : targets}
                  value={formData.target || ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next !== formData.target) {
                      setFormData({ ...formData, target: next });
                    }
                  }}
                  onCreate={async (name) => {
                    try {
                      const trimmed = String(name || "").trim();
                      if (!trimmed) return;
                      // For income, target (destination) should go to sources list
                      // For expense, target (destination) should go to targets list
                      if (formData.type === "income") {
                        if (!sources.some((n) => String(n).trim().toLowerCase() === trimmed.toLowerCase())) {
                          setSources([...sources, trimmed]);
                        }
                      } else {
                        if (!targets.some((n) => String(n).trim().toLowerCase() === trimmed.toLowerCase())) {
                          setTargets([...targets, trimmed]);
                        }
                      }
                      if (trimmed !== formData.target) {
                        setFormData({ ...formData, target: trimmed });
                      }
                    } catch (err) {
                      console.error("Error handling new target:", err);
                    }
                  }}
                  placeholder={t("enterTarget")}
                />
              </div>
            </div>
            {/* Recurring Transaction Options */}
            <div className="border-t pt-6">
              <div className="form-group">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    checked={formData.isRecurring}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isRecurring: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-300">
                    {t("makeRecurring")}
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                  {t("makeRecurringDescription")}
                </p>
              </div>

              {formData.isRecurring && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <Dropdown
                        id="recurrence_type"
                        name="recurrence_type"
                        label={t("recurrenceType")}
                        required={true}
                        options={[
                          { value: "daily", label: t("daily") },
                          { value: "weekly", label: t("weekly") },
                          { value: "monthly", label: t("monthly") },
                          { value: "yearly", label: t("yearly") },
                        ]}
                        value={formData.recurrence_type}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="number"
                        id="recurrence_interval"
                        name="recurrence_interval"
                        label={t("recurrenceInterval")}
                        value={formData.recurrence_interval}
                        onChange={handleChange}
                        min="1"
                        required
                        placeholder="1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t("recurrenceIntervalDescription", {
                          interval: formData.recurrence_interval,
                          type: t(formData.recurrence_type),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <Input
                        type="date"
                        id="end_date"
                        name="end_date"
                        label={t("endDate")}
                        value={formData.end_date}
                        onChange={handleChange}
                        min={formData.date}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t("endDateDescription")}
                      </p>
                    </div>

                    <div className="form-group">
                      <Input
                        type="number"
                        id="max_occurrences"
                        name="max_occurrences"
                        label={t("maxOccurrences")}
                        value={formData.max_occurrences}
                        onChange={handleChange}
                        min="1"
                        placeholder={t("unlimited")}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t("maxOccurrencesDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">
                          {t("recurringTransactionPreview")}
                        </p>
                        <p>
                          {t("recurringPreviewText", {
                            amount: formatCurrency(formData.amount || 0),
                            type: t(formData.recurrence_type),
                            interval: formData.recurrence_interval,
                            startDate: new Date(
                              formData.date,
                            ).toLocaleDateString(),
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex justify-between items-center gap-4 pt-6">
              <div
                className="icon-circle p-3 cursor-pointer active:scale-95"
                onClick={() => setShowDeleteModal(true)}
              >
                <img
                  src="/icons/trash.svg"
                  alt={t("delete")}
                  className="w-6 h-6 icon-tint-danger"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  icon={
                    <Icon
                      src="/icons/save.svg"
                      size="md"
                      variant="accent"
                      className="flex-shrink-0 w-6 h-6"
                    />
                  }
                  haptic="impact"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <span className="spinner mr-1 sm:mr-2"></span>
                      <span className="hidden sm:inline">{t("updating")}</span>
                    </span>
                  ) : (
                    <>
                      <span className="sm:hidden">{t("save")}</span>
                      <span className="hidden sm:inline">
                        {t("saveTransaction")}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <Modal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t("pleaseConfirm")}
        onConfirm={handleDelete}
        confirmText={t("delete")}
      >
        <p>{t("areYouSureYouWantToDeleteThisTransaction")}</p>
      </Modal>
    </div>
  );
};

export default EditTransaction;
