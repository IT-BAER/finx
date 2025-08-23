import { createContext, useContext, useState, useEffect } from "react";
import offlineAPI from "../services/offlineAPI";

const SharingContext = createContext();

export const useSharing = () => {
  const context = useContext(SharingContext);
  if (!context) {
    throw new Error("useSharing must be used within a SharingProvider");
  }
  return context;
};

export const SharingProvider = ({ children }) => {
  const [myPermissions, setMyPermissions] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch user's sharing permissions
  const fetchMyPermissions = async () => {
    try {
      setLoading(true);
      const res = await offlineAPI.get("/sharing/my-permissions");
      setMyPermissions(res.data);
      setError("");
    } catch (err) {
      setError("Failed to load sharing permissions");
      console.error("Error loading sharing permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data shared with current user
  const fetchSharedWithMe = async () => {
    try {
      setLoading(true);
      const res = await offlineAPI.get("/sharing/shared-with-me");
      setSharedWithMe(res.data);
      setError("");
    } catch (err) {
      setError("Failed to load shared data");
      console.error("Error loading shared data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new sharing permission
  const createPermission = async (permissionData) => {
    try {
      setLoading(true);
      const res = await offlineAPI.post("/sharing", permissionData);
      await fetchMyPermissions(); // Refresh the list
      setError("");
      return res;
    } catch (err) {
      setError("Failed to create sharing permission");
      console.error("Error creating sharing permission:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update a sharing permission
  const updatePermission = async (id, updates) => {
    try {
      setLoading(true);
      const res = await offlineAPI.put(`/sharing/${id}`, updates);
      await fetchMyPermissions(); // Refresh the list
      setError("");
      return res;
    } catch (err) {
      setError("Failed to update sharing permission");
      console.error("Error updating sharing permission:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete a sharing permission
  const deletePermission = async (id) => {
    try {
      setLoading(true);
      const res = await offlineAPI.delete(`/sharing/${id}`);
      await fetchMyPermissions(); // Refresh the list
      setError("");
      return res;
    } catch (err) {
      setError("Failed to delete sharing permission");
      console.error("Error deleting sharing permission:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get all users for selection
  const getAllUsers = async () => {
    try {
      const res = await offlineAPI.get("/sharing/users");
      return res.data;
    } catch (err) {
      setError("Failed to load users");
      console.error("Error loading users:", err);
      throw err;
    }
  };

  // Get all sources for the current user
  const getUserSources = async () => {
    try {
      const res = await offlineAPI.get("/sharing/sources");
      return res.data;
    } catch (err) {
      setError("Failed to load sources");
      console.error("Error loading sources:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {
      fetchMyPermissions();
      fetchSharedWithMe();
    }
  }, []);

  const value = {
    myPermissions,
    sharedWithMe,
    loading,
    error,
    fetchMyPermissions,
    fetchSharedWithMe,
    createPermission,
    updatePermission,
    deletePermission,
    getAllUsers,
    getUserSources,
  };

  return (
    <SharingContext.Provider value={value}>{children}</SharingContext.Provider>
  );
};
