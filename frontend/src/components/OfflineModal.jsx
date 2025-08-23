import React from "react";
import Button from "./Button";

const OfflineModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {title || "Offline Mode"}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message ||
              "This feature is not available in offline mode. Please connect to the internet to access this functionality."}
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineModal;
