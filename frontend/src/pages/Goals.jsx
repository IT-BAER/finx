import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { motionTheme } from "../utils/motionTheme.js";
import Button from "../components/Button.jsx";
import Modal from "../components/Modal.jsx";
import Input from "../components/Input.jsx";
import Icon from "../components/Icon.jsx";
import { AnimatedPage, AnimatedSection } from "../components/AnimatedPage";
import {
  useGoals,
  useGoalsSummary,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useAddGoalContribution,
} from "../hooks/useQueries";

// Goal icon options
const GOAL_ICONS = [
  { id: "savings", label: "Savings", emoji: "💰" },
  { id: "vacation", label: "Vacation", emoji: "✈️" },
  { id: "car", label: "Car", emoji: "🚗" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "emergency", label: "Emergency", emoji: "🛡️" },
  { id: "gift", label: "Gift", emoji: "🎁" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "health", label: "Health", emoji: "🏥" },
  { id: "other", label: "Other", emoji: "🎯" },
];

// Goal color options
const GOAL_COLORS = [
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#6366f1", // indigo
];

const Goals = () => {
  const { t } = useTranslation();
  const { dark } = useTheme();
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  
  // Load showCompleted preference from localStorage
  const [showCompleted, setShowCompleted] = useState(() => {
    const saved = localStorage.getItem("goals_showCompleted");
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save showCompleted preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("goals_showCompleted", JSON.stringify(showCompleted));
  }, [showCompleted]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    deadline: "",
    icon: "savings",
    color: "#06b6d4",
  });
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");

  // React Query hooks for goals data
  const { 
    data: goals = [], 
    isLoading: loading, 
    error: goalsError 
  } = useGoals({ includeCompleted: showCompleted });
  
  const { data: summary = null } = useGoalsSummary();
  
  // Mutation hooks
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const addContributionMutation = useAddGoalContribution();
  
  // Combined loading state for form operations
  const formLoading = createGoalMutation.isPending || 
    updateGoalMutation.isPending || 
    deleteGoalMutation.isPending || 
    addContributionMutation.isPending;

  // Show error toast if goals fail to load
  if (goalsError) {
    console.error("Failed to load goals:", goalsError);
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      target_amount: "",
      deadline: "",
      icon: "savings",
      color: "#06b6d4",
    });
    setContributionAmount("");
    setContributionNote("");
  };

  // Handle create goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.target_amount) {
      window.toastWithHaptic?.error(t("pleaseFillAllRequiredFields") || "Please fill all required fields");
      return;
    }

    try {
      await createGoalMutation.mutateAsync({
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        deadline: formData.deadline || null,
        icon: formData.icon,
        color: formData.color,
      });
      window.toastWithHaptic?.success(t("goalCreatedSuccessfully") || "Goal created successfully");
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create goal:", error);
      window.toastWithHaptic?.error(t("failedToCreateGoal") || "Failed to create goal");
    }
  };

  // Handle update goal
  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    if (!selectedGoal || !formData.name || !formData.target_amount) {
      window.toastWithHaptic?.error(t("pleaseFillAllRequiredFields") || "Please fill all required fields");
      return;
    }

    try {
      await updateGoalMutation.mutateAsync({
        id: selectedGoal.id,
        data: {
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          deadline: formData.deadline || null,
          icon: formData.icon,
          color: formData.color,
        },
      });
      window.toastWithHaptic?.success(t("goalUpdatedSuccessfully") || "Goal updated successfully");
      setShowEditModal(false);
      setSelectedGoal(null);
      resetForm();
    } catch (error) {
      console.error("Failed to update goal:", error);
      window.toastWithHaptic?.error(t("failedToUpdateGoal") || "Failed to update goal");
    }
  };

  // Handle delete goal
  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;

    try {
      await deleteGoalMutation.mutateAsync(selectedGoal.id);
      window.toastWithHaptic?.success(t("goalDeletedSuccessfully") || "Goal deleted successfully");
      setShowDeleteModal(false);
      setSelectedGoal(null);
    } catch (error) {
      console.error("Failed to delete goal:", error);
      window.toastWithHaptic?.error(t("failedToDeleteGoal") || "Failed to delete goal");
    }
  };

  // Handle add contribution
  const handleAddContribution = async (e) => {
    e.preventDefault();
    if (!selectedGoal || !contributionAmount || parseFloat(contributionAmount) <= 0) {
      window.toastWithHaptic?.error(t("pleaseEnterValidAmount") || "Please enter a valid amount");
      return;
    }

    try {
      await addContributionMutation.mutateAsync({
        goalId: selectedGoal.id,
        data: {
          amount: parseFloat(contributionAmount),
          note: contributionNote || null,
        },
      });
      window.toastWithHaptic?.success(t("contributionAddedSuccessfully") || "Contribution added successfully");
      setShowContributeModal(false);
      setSelectedGoal(null);
      setContributionAmount("");
      setContributionNote("");
    } catch (error) {
      console.error("Failed to add contribution:", error);
      window.toastWithHaptic?.error(t("failedToAddContribution") || "Failed to add contribution");
    }
  };

  // Open edit modal
  const openEditModal = (goal) => {
    setSelectedGoal(goal);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      deadline: goal.deadline ? goal.deadline.split("T")[0] : "",
      icon: goal.icon || "savings",
      color: goal.color || "#06b6d4",
    });
    setShowEditModal(true);
  };

  // Open contribute modal
  const openContributeModal = (goal) => {
    setSelectedGoal(goal);
    setContributionAmount("");
    setContributionNote("");
    setShowContributeModal(true);
  };

  // Open delete modal
  const openDeleteModal = (goal) => {
    setSelectedGoal(goal);
    setShowDeleteModal(true);
  };

  // Toggle goal completion
  const toggleGoalCompletion = async (goal) => {
    try {
      await updateGoalMutation.mutateAsync({
        id: goal.id,
        data: { is_completed: !goal.is_completed },
      });
    } catch (error) {
      console.error("Failed to toggle goal completion:", error);
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(t("locale") || "en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get icon emoji
  const getIconEmoji = (iconId) => {
    const icon = GOAL_ICONS.find((i) => i.id === iconId);
    return icon?.emoji || "🎯";
  };

  // Calculate progress percentage
  const getProgress = (goal) => {
    if (goal.target_amount <= 0) return 0;
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  };

  // Render goal card
  const GoalCard = ({ goal }) => {
    const progress = getProgress(goal);
    const daysRemaining = getDaysRemaining(goal.deadline);
    const isOverdue = daysRemaining !== null && daysRemaining < 0;
    const isNearDeadline = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileTap={{ scale: 0.98 }}
        transition={motionTheme.springs.hover}
        className={`card p-5 relative overflow-hidden ${
          goal.is_completed ? "opacity-75" : ""
        }`}
        style={{
          borderLeft: `4px solid ${goal.color || "#06b6d4"}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label={goal.icon}>
              {getIconEmoji(goal.icon)}
            </span>
            <div>
              <h3 className={`font-semibold text-lg ${goal.is_completed ? "line-through opacity-60" : ""}`}>
                {goal.name}
              </h3>
              {goal.deadline && (
                <p
                  className={`text-sm ${
                    isOverdue
                      ? "text-red-500"
                      : isNearDeadline
                        ? "text-yellow-500"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {isOverdue
                    ? `${Math.abs(daysRemaining)} ${t("daysOverdue") || "days overdue"}`
                    : daysRemaining === 0
                      ? t("dueToday") || "Due today"
                      : `${daysRemaining} ${t("daysLeft") || "days left"}`}
                </p>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => openEditModal(goal)}
              className={`p-2 rounded-full transition-colors ${
                dark ? "hover:bg-gray-700" : "hover:bg-gray-100"
              }`}
              title={t("edit") || "Edit"}
            >
              <img src="/icons/edit.svg" alt="Edit" className="w-5 h-5 icon-tint-accent" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => openDeleteModal(goal)}
              className={`p-2 rounded-full transition-colors ${
                dark ? "hover:bg-gray-700 hover:bg-opacity-50" : "hover:bg-red-50"
              }`}
              title={t("delete") || "Delete"}
            >
              <img src="/icons/trash.svg" alt="Delete" className="w-5 h-5 icon-tint-danger" />
            </motion.button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{formatCurrency(goal.current_amount)}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {t("of") || "of"} {formatCurrency(goal.target_amount)}
            </span>
          </div>
          <div className={`h-3 rounded-full overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-200"}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: goal.color || "#06b6d4" }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-500 dark:text-gray-400">
              {progress.toFixed(1)}% {t("complete") || "complete"}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {formatCurrency(goal.target_amount - goal.current_amount)} {t("remaining") || "remaining"}
            </span>
          </div>
        </div>

        {/* Completion checkbox */}
        <div className="flex items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={goal.is_completed}
              onChange={() => toggleGoalCompletion(goal)}
              className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
            />
            <span className={`text-sm ${goal.is_completed ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}>
              {goal.is_completed ? (t("goalCompleted") || "Goal completed! 🎉") : (t("markAsComplete") || "Mark as complete")}
            </span>
          </label>
        </div>

        {/* Floating Add Contribution Button */}
        {!goal.is_completed && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openContributeModal(goal)}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors"
            style={{ 
              backgroundColor: goal.color || "#06b6d4",
              boxShadow: `0 2px 8px ${goal.color || "#06b6d4"}40`
            }}
            title={t("addContribution") || "Add contribution"}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </motion.button>
        )}
      </motion.div>
    );
  };

  // Render summary cards
  const SummaryCards = () => {
    if (!summary) return null;

    const totalProgress = summary.total_target > 0
      ? ((summary.total_saved / summary.total_target) * 100).toFixed(1)
      : 0;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`card p-4 ${dark ? "bg-cyan-900/20" : "bg-cyan-50"}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("totalSaved") || "Total Saved"}</p>
          <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
            {formatCurrency(parseFloat(summary.total_saved) || 0)}
          </p>
        </div>
        <div className={`card p-4 ${dark ? "bg-blue-900/20" : "bg-blue-50"}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("totalTarget") || "Total Target"}</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(parseFloat(summary.total_target) || 0)}
          </p>
        </div>
        <div className={`card p-4 ${dark ? "bg-green-900/20" : "bg-green-50"}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("activeGoals") || "Active Goals"}</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {summary.active_goals || 0}
          </p>
        </div>
        <div className={`card p-4 ${dark ? "bg-purple-900/20" : "bg-purple-50"}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("overallProgress") || "Overall Progress"}</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {totalProgress}%
          </p>
        </div>
      </div>
    );
  };

  // Render goal form fields (inline to avoid focus issues)
  const renderGoalFormFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">{t("goalName") || "Goal Name"} *</label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t("enterGoalName") || "Enter goal name"}
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">{t("targetAmount") || "Target Amount"} *</label>
        <Input
          type="number"
          value={formData.target_amount}
          onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">{t("deadline") || "Deadline"}</label>
        <Input
          type="date"
          value={formData.deadline}
          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
          min={new Date().toISOString().split("T")[0]}
        />
      </div>
      
      {/* Icon selector */}
      <div>
        <label className="block text-sm font-medium mb-2">{t("icon") || "Icon"}</label>
        <div className="flex flex-wrap gap-2">
          {GOAL_ICONS.map((icon) => (
            <button
              key={icon.id}
              type="button"
              onClick={() => setFormData({ ...formData, icon: icon.id })}
              className={`p-2 text-xl rounded-lg transition-all ${
                formData.icon === icon.id
                  ? "bg-cyan-100 dark:bg-cyan-900/30 ring-2 ring-cyan-500"
                  : dark ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"
              }`}
              title={icon.label}
            >
              {icon.emoji}
            </button>
          ))}
        </div>
      </div>
      
      {/* Color selector */}
      <div>
        <label className="block text-sm font-medium mb-2">{t("color") || "Color"}</label>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-8 h-8 rounded-full transition-all ${
                formData.color === color ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500" : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </>
  );

  return (
    <AnimatedPage>
    <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="display-2 leading-none">{t("goals") || "Goals"}</h1>
        <motion.div
          whileTap={{ scale: 0.95 }}
          transition={motionTheme.springs.press}
        >
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            icon="/icons/add.svg"
          >
            {t("addGoal") || "Add Goal"}
          </Button>
        </motion.div>
      </motion.div>

      <AnimatedSection delay={0.2}>
      {/* Summary cards */}
      <SummaryCards />

      {/* Filter toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {goals.length} {goals.length === 1 ? (t("goal") || "goal") : (t("goalsPlural") || "goals")}
        </p>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t("showCompleted") || "Show completed"}
          </span>
        </label>
      </div>

      {/* Goals list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : goals.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold mb-2">
            {t("noGoalsYet") || "No goals yet"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t("createYourFirstGoal") || "Create your first savings goal to start tracking your progress"}
          </p>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            {t("createGoal") || "Create Goal"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal
        show={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={t("addGoal") || "Add Goal"}
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          {renderGoalFormFields()}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? (t("saving") || "Saving...") : (t("createGoal") || "Create Goal")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Goal Modal */}
      <Modal
        show={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedGoal(null);
          resetForm();
        }}
        title={t("editGoal") || "Edit Goal"}
      >
        <form onSubmit={handleUpdateGoal} className="space-y-4">
          {renderGoalFormFields()}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedGoal(null);
                resetForm();
              }}
              className="flex-1"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? (t("saving") || "Saving...") : (t("saveChanges") || "Save Changes")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Contribution Modal */}
      <Modal
        show={showContributeModal}
        onClose={() => {
          setShowContributeModal(false);
          setSelectedGoal(null);
          setContributionAmount("");
          setContributionNote("");
        }}
        title={t("addContribution") || "Add Contribution"}
      >
        <form onSubmit={handleAddContribution} className="space-y-4">
          {selectedGoal && (
            <div className={`p-4 rounded-lg ${dark ? "bg-gray-700/50" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{getIconEmoji(selectedGoal.icon)}</span>
                <span className="font-medium">{selectedGoal.name}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t("currentProgress") || "Current progress"}: {formatCurrency(selectedGoal.current_amount)} / {formatCurrency(selectedGoal.target_amount)}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("amount") || "Amount"} *</label>
            <Input
              type="number"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("note") || "Note"}</label>
            <Input
              type="text"
              value={contributionNote}
              onChange={(e) => setContributionNote(e.target.value)}
              placeholder={t("optionalNote") || "Optional note..."}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowContributeModal(false);
                setSelectedGoal(null);
                setContributionAmount("");
                setContributionNote("");
              }}
              className="flex-1"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? (t("adding") || "Adding...") : (t("addContribution") || "Add Contribution")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedGoal(null);
        }}
        title={t("confirmDelete") || "Confirm Delete"}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {t("areYouSureYouWantToDeleteThisGoal") || "Are you sure you want to delete this goal? This action cannot be undone."}
          </p>
          {selectedGoal && (
            <div className={`p-4 rounded-lg ${dark ? "bg-gray-700/50" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{getIconEmoji(selectedGoal.icon)}</span>
                <span className="font-medium">{selectedGoal.name}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrency(selectedGoal.current_amount)} / {formatCurrency(selectedGoal.target_amount)}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedGoal(null);
              }}
              className="flex-1"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteGoal}
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? (t("deleting") || "Deleting...") : (t("delete") || "Delete")}
            </Button>
          </div>
        </div>
      </Modal>
      </AnimatedSection>
    </div>
    </AnimatedPage>
  );
};

export default Goals;
