import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import { useTranslation } from "../hooks/useTranslation";

const Modal = ({ show, onClose, title, children, onConfirm, confirmText }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (!show) return;

    // Touch swipe detection variables
    let touchStartX = 0;
    let touchStartY = 0;

    // When modal is open we rely on CSS flex centering (backdrop uses items-center)
    // Avoid dynamic position updates on scroll which cause the modal to drift.

    // Touch event handlers for swipe detection
    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (!touchStartX || !touchStartY) return;

      const touchEndX = e.touches[0].clientX;
      const touchEndY = e.touches[0].clientY;

      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      // Check if horizontal swipe is more significant than vertical
      if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal swipe detected, close modal
        if (Math.abs(diffX) > 10) {
          // Minimum swipe distance
          onClose();
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartX = 0;
      touchStartY = 0;
    };

    // Prevent background scrolling while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Add touch event listeners for swipe detection on backdrop
    const backdropElement = backdropRef.current;
    if (backdropElement) {
      backdropElement.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      backdropElement.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      backdropElement.addEventListener("touchend", handleTouchEnd, {
        passive: true,
      });
    }

    return () => {
      // Restore body overflow
      document.body.style.overflow = prevOverflow || "";

      // Remove touch event listeners from backdrop
      if (backdropElement) {
        backdropElement.removeEventListener("touchstart", handleTouchStart);
        backdropElement.removeEventListener("touchmove", handleTouchMove);
        backdropElement.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [show, onClose]);

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          ref={backdropRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={onClose}
        >
          <motion.div
            ref={modalRef}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-[92%] max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>
            <div>{children}</div>
            {onConfirm && (
              <div className="flex justify-end space-x-4 mt-6">
                <Button variant="secondary" onClick={onClose}>
                  {t("cancel")}
                </Button>
                <Button variant="primary" onClick={onConfirm}>
                  {confirmText || t("confirm")}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    // Portal into body so modal overlays entire viewport and isn't clipped by parent containers
    typeof document !== "undefined" ? document.body : null,
  );
};

export default Modal;
