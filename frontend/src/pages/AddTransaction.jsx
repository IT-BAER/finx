import { useState, useEffect } from "react";
import "../utils/haptics.js";
import { useNavigate } from "react-router-dom";
import offlineAPI from "../services/offlineAPI.js";
import { recurringTransactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import Dropdown from "../components/Dropdown.jsx";
import DropdownWithInput from "../components/DropdownWithInput.jsx";
import Button from "../components/Button.jsx";
import Icon from "../components/Icon.jsx";
import Input from "../components/Input.jsx";
import { motion } from "framer-motion";

const AddTransaction = () => {
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [formData, setFormData] = useState({
    type: "expense",
    date: new Date().toISOString().split("T")[0],
    category: "",
    amount: "",
    description: "",
    source: "",
    target: "",
    // Recurring transaction fields
    isRecurring: false,
    recurrence_type: "monthly",
    recurrence_interval: 1,
    end_date: "",
    max_occurrences: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { t, language, formatCurrency } = useTranslation();

  useEffect(() => {
    loadCategories();
    loadSources();
    loadTargets();
  }, []);

  // Ensure category is cleared whenever type switches to income (defensive)
  useEffect(() => {
    if (formData.type === "income" && formData.category) {
      setFormData((f) => ({ ...f, category: "", category_id: "" }));
    }
  }, [formData.type]);

  const loadSources = async () => {
    try {
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
      setError(t("failedToLoadCategories"));
      console.error("Error loading categories:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // When switching to income clear category and category_id
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

    const handleSubmit = async (e, options = { keepOnPage: false }) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
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

    // Additional validation for recurring transactions
    if (formData.isRecurring) {
      if (
        formData.end_date &&
        new Date(formData.end_date) <= new Date(formData.date)
      ) {
        setError(t("endDateMustBeAfterStartDate"));
        setLoading(false);
        return;
      }

      if (
        formData.max_occurrences &&
        (isNaN(formData.max_occurrences) ||
          parseInt(formData.max_occurrences) < 1)
      ) {
        setError(t("maxOccurrencesMustBePositive"));
        setLoading(false);
        return;
      }
    }

    try {
      // Default empty target to localized "Misc"/"Sonstiges"
      const defaultTarget = language === "de" ? "Sonstiges" : "Misc";
      const _base = {
        ...formData,
        category: formData.type !== "income" ? String(formData.category || "").trim() : "",
        source: String(formData.source || "").trim(),
        target: String(formData.target || "").trim() || defaultTarget,
      };
      if (_base.type === "income") {
        _base.category = "";
        _base.category_id = null;
      }
      const dataToSend = _base;

      // Always create the base transaction first
      const result = await offlineAPI.createTransaction(dataToSend);
      if (result.skipped) {
        window.toastWithHaptic.info(
          t("duplicateTransactionSkipped") ||
            "A matching transaction already exists for this date and details. Skipped.",
        );
      } else if (result.queued) {
        window.toastWithHaptic.info(t("changesQueuedOffline"));
      } else if (result.transaction) {
        window.toastWithHaptic.success(t("transactionAddedSuccess"));
      }

      

      // Dispatch a custom event to notify the Transactions page to refresh
      window.dispatchEvent(new CustomEvent("transactionAdded"));
      if (!options.keepOnPage) {
        navigate("/transactions");
      } else {
        // Clear form fields so user can create another transaction
        setFormData({
          type: "expense",
          date: new Date().toISOString().split("T")[0],
          category: "",
          amount: "",
          description: "",
          source: "",
          target: "",
          isRecurring: false,
          recurrence_type: "monthly",
          recurrence_interval: 1,
          end_date: "",
          max_occurrences: "",
        });
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || t("failedToAddTransaction");
      window.toastWithHaptic.error(errorMessage);
      console.error("Error adding transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Listen for programmatic submit event from mobile FAB when already on add page
  useEffect(() => {
    const onProgrammaticSubmit = async () => {
      // Submit but keep the user on the add page and clear the form on success
      await handleSubmit(null, { keepOnPage: true });
    };

    window.addEventListener("submitAddTransaction", onProgrammaticSubmit);
    return () =>
      window.removeEventListener("submitAddTransaction", onProgrammaticSubmit);
  }, [formData, categories, sources, targets]);

  return (
    <div className="container mx-auto px-4 pt-0 pb-8 sm:pb-8 min-h-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="display-2 leading-none">{t("addTransaction")}</h1>
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
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                navigate("/transactions");
              }}
              icon={<Icon src="/icons/back.svg" size="md" variant="accent" className="icon-md" />}
            >
              {t("back")}
            </Button>
          </div>
        </div>
      </div>

      {/* Error alerts removed - using toast notifications instead */}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group md:col-span-2">
                <label htmlFor="type" className="form-label">
                  {t("type")} *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <motion.label
                    className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === "income" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 800, damping: 30 }}
                    onClick={() => setFormData({ ...formData, type: "income", category: "", category_id: "" })}
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
                  </motion.label>
                  <motion.label
                    className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === "expense" ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 800, damping: 30 }}
                    onClick={() => setFormData({ ...formData, type: "expense" })}
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
                  </motion.label>
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
                      // Optimistically extend categories (UI only), dedupe by trim/lower
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
                      // Do not create immediately; only reflect in UI list and set field
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
                      console.error("Error handling new source/target:", err);
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
                      // Do not create immediately; only reflect in UI list and set field
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
                      console.error("Error handling new target/source:", err);
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

            <div className="flex flex-col-reverse md:flex-row justify-end gap-4 pt-6">
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
                className="w-auto ml-auto"
                icon={<Icon src="/icons/add.svg" size="md" variant="accent" className="icon-md w-6 h-6" />}
                haptic="impact"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="spinner mr-2"></span>
                    {formData.isRecurring
                      ? t("creatingRecurring")
                      : t("adding")}
                  </span>
                ) : formData.isRecurring ? (
                  t("createRecurring")
                ) : (
                  t("add")
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddTransaction;
