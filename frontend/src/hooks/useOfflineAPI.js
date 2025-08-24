import { useState, useEffect, useCallback } from "react";
import offlineAPI from "../services/offlineAPI.js";
import { getIsOnline } from "../services/connectivity.js";
import toast from "react-hot-toast";

export const useOfflineAPI = () => {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? getIsOnline() : true,
  );
  const [syncStatus, setSyncStatus] = useState({
    isOnline: typeof window !== "undefined" ? getIsOnline() : true,
    pendingSync: 0,
    hasOfflineData: false,
  });

  useEffect(() => {
    const updateStatus = async () => {
      const status = await offlineAPI.getSyncStatus();
      setSyncStatus(status);
      setIsOnline(status.isOnline);
    };

    updateStatus();

    const handleConn = (e) => {
      const nowOnline = !!(e && e.detail && e.detail.isOnline);
      setIsOnline(nowOnline);
      updateStatus();
    };

    window.addEventListener("serverConnectivityChange", handleConn);

    return () => {
      window.removeEventListener("serverConnectivityChange", handleConn);
    };
  }, []);

  // Transactions
  const useTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTransactions = useCallback(async (params = {}) => {
      try {
        setLoading(true);
        setError(null);
        const data = await offlineAPI.getAllTransactions(params);
        setTransactions(data);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    }, []);

    const createTransaction = useCallback(async (transactionData) => {
      try {
        const newTransaction =
          await offlineAPI.createTransaction(transactionData);
        setTransactions((prev) => [newTransaction, ...prev]);

        if (newTransaction._isOffline) {
          toast.success("Transaction saved offline");
        } else {
          toast.success("Transaction created");
        }

        return newTransaction;
      } catch (err) {
        toast.error("Failed to create transaction");
        throw err;
      }
    }, []);

    const updateTransaction = useCallback(async (id, transactionData) => {
      try {
        const updatedTransaction = await offlineAPI.updateTransaction(
          id,
          transactionData,
        );
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id || t._tempId === id ? updatedTransaction : t,
          ),
        );

        if (updatedTransaction._isOffline) {
          toast.success("Transaction updated offline");
        } else {
          toast.success("Transaction updated");
        }

        return updatedTransaction;
      } catch (err) {
        toast.error("Failed to update transaction");
        throw err;
      }
    }, []);

    const deleteTransaction = useCallback(async (id) => {
      try {
        await offlineAPI.deleteTransaction(id);
        setTransactions((prev) =>
          prev.filter((t) => t.id !== id && t._tempId !== id),
        );
        toast.success("Transaction deleted");
      } catch (err) {
        toast.error("Failed to delete transaction");
        throw err;
      }
    }, []);

    return {
      transactions,
      loading,
      error,
      fetchTransactions,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      refetch: fetchTransactions,
    };
  };

  // Categories
  const useCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCategories = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await offlineAPI.getCategories();
        setCategories(data);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load categories");
      } finally {
        setLoading(false);
      }
    }, []);

    const createCategory = useCallback(async (categoryData) => {
      try {
        const newCategory = await offlineAPI.createCategory(categoryData);
        setCategories((prev) => [...prev, newCategory]);
        toast.success("Category created");
        return newCategory;
      } catch (err) {
        toast.error("Failed to create category");
        throw err;
      }
    }, []);

    return {
      categories,
      loading,
      error,
      fetchCategories,
      createCategory,
      refetch: fetchCategories,
    };
  };

  // Sources
  const useSources = () => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSources = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await offlineAPI.getSources();
        setSources(data);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load sources");
      } finally {
        setLoading(false);
      }
    }, []);

    const createSource = useCallback(async (sourceData) => {
      try {
        const newSource = await offlineAPI.createSource(sourceData);
        setSources((prev) => [...prev, newSource]);
        toast.success("Source created");
        return newSource;
      } catch (err) {
        toast.error("Failed to create source");
        throw err;
      }
    }, []);

    return {
      sources,
      loading,
      error,
      fetchSources,
      createSource,
      refetch: fetchSources,
    };
  };

  // Targets
  const useTargets = () => {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTargets = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await offlineAPI.getTargets();
        setTargets(data);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load targets");
      } finally {
        setLoading(false);
      }
    }, []);

    const createTarget = useCallback(async (targetData) => {
      try {
        const newTarget = await offlineAPI.createTarget(targetData);
        setTargets((prev) => [...prev, newTarget]);
        toast.success("Target created");
        return newTarget;
      } catch (err) {
        toast.error("Failed to create target");
        throw err;
      }
    }, []);

    return {
      targets,
      loading,
      error,
      fetchTargets,
      createTarget,
      refetch: fetchTargets,
    };
  };

  return {
    isOnline,
    syncStatus,
    api: offlineAPI,
    useTransactions,
    useCategories,
    useSources,
    useTargets,
  };
};

export default useOfflineAPI;
